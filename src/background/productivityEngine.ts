import { storageGet, storageSet, KEYS } from '../shared/storage';
import type { Task, ProductivityRollup, FocusSession, TabSnapshot } from '../shared/types';
import { isProductive, isDistracting } from '../shared/utils';

// ─── Productivity Engine ──────────────────────────────────────────────────────

export function initProductivityEngine() {
  // Recompute rollups every 5 minutes
  chrome.alarms.create('ex1:productivity:tick', { periodInMinutes: 5 });
  chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === 'ex1:productivity:tick') await computeAllRollups();
  });
  // Initial compute
  computeAllRollups();
}

// ─── Task CRUD ────────────────────────────────────────────────────────────────

export async function addTask(data: {
  title: string; description: string; category: string;
  dueAt: number | null; priority: string;
}): Promise<Task> {
  const tasks = (await storageGet<Task[]>(KEYS.TASKS)) ?? [];
  const task: Task = {
    id: `task_${Date.now()}`,
    title: data.title,
    description: data.description,
    category: data.category,
    createdAt: Date.now(),
    dueAt: data.dueAt,
    priority: data.priority as Task['priority'],
    status: 'pending',
  };
  tasks.push(task);
  await storageSet(KEYS.TASKS, tasks);
  return task;
}

export async function updateTask(id: string, updates: Partial<Task>): Promise<void> {
  const tasks = (await storageGet<Task[]>(KEYS.TASKS)) ?? [];
  const idx = tasks.findIndex((t) => t.id === id);
  if (idx < 0) return;
  tasks[idx] = { ...tasks[idx], ...updates };
  await storageSet(KEYS.TASKS, tasks);
}

export async function deleteTask(id: string): Promise<void> {
  const tasks = (await storageGet<Task[]>(KEYS.TASKS)) ?? [];
  await storageSet(KEYS.TASKS, tasks.filter((t) => t.id !== id));
}

// ─── Rollup computation ───────────────────────────────────────────────────────

export async function computeAllRollups() {
  await computeRollup('daily');
  await computeRollup('weekly');
}

async function computeRollup(period: 'daily' | 'weekly'): Promise<void> {
  const [sessions, snapshot, tasks] = await Promise.all([
    storageGet<FocusSession[]>(KEYS.FOCUS_SESSIONS),
    storageGet<TabSnapshot>(KEYS.TAB_SNAPSHOT),
    storageGet<Task[]>(KEYS.TASKS),
  ]);

  const cutoff = period === 'daily'
    ? Date.now() - 86_400_000
    : Date.now() - 7 * 86_400_000;

  // Focus sessions in period
  const periodSessions = (sessions ?? []).filter((s) => s.startedAt >= cutoff);
  const completedSessions = periodSessions.filter((s) => s.status === 'completed');
  const sessionCount = periodSessions.length;
  const completionRate = sessionCount > 0 ? completedSessions.length / sessionCount : 0;
  const totalFocusMs = completedSessions.reduce((acc, s) => acc + s.durationMinutes * 60_000, 0);
  const distractionAttempts = periodSessions.reduce((acc, s) => acc + s.distractionAttempts, 0);

  // Tab usage stats from persistent history
  let productiveMs = 0, neutralMs = 0, distractingMs = 0;
  try {
    const history = (await storageGet<Record<string, { productiveMs: number; neutralMs: number; distractingMs: number }>>('ex1:productivity_history')) ?? {};
    const datesToSum: string[] = [];
    if (period === 'daily') {
      const today = new Date().toISOString().split('T')[0];
      datesToSum.push(today);
    } else {
      // Last 7 days
      for (let i = 0; i < 7; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        datesToSum.push(d.toISOString().split('T')[0]);
      }
    }
    for (const dateKey of datesToSum) {
      if (history[dateKey]) {
        productiveMs += history[dateKey].productiveMs || 0;
        neutralMs += history[dateKey].neutralMs || 0;
        distractingMs += history[dateKey].distractingMs || 0;
      }
    }
  } catch (err) {
    console.error('[productivityEngine] error reading productivity history:', err);
  }

  // Task stats
  const allTasks = tasks ?? [];
  const completedTasks = allTasks.filter((t) => t.status === 'completed');
  const overdueTasks = allTasks.filter(
    (t) => t.dueAt && t.dueAt < Date.now() && t.status !== 'completed'
  );
  const staleTasks = allTasks.filter(
    (t) => t.status === 'pending' && Date.now() - t.createdAt > 7 * 86_400_000
  );

  // ─── Score computation (Base 75 + adjustments) ─────────────────────────
  let score = 75;
  const positiveFactors: { label: string; contribution: number }[] = [];
  const negativeFactors:  { label: string; contribution: number }[] = [];

  const totalBrowsingMs = productiveMs + distractingMs + neutralMs;

  if (totalBrowsingMs > 0) {
    const productiveRatio = productiveMs / (productiveMs + distractingMs || 1);
    if (productiveRatio >= 0.7) {
      const bonus = Math.round((productiveRatio - 0.7) * 50); // up to +15
      if (bonus > 0) {
        positiveFactors.push({ label: `High productivity ratio (${Math.round(productiveRatio * 100)}%)`, contribution: bonus });
        score += bonus;
      }
    } else if (productiveRatio < 0.4) {
      const penalty = Math.round((0.4 - productiveRatio) * 50); // up to -20
      if (penalty > 0) {
        negativeFactors.push({ label: `Low productivity ratio (${Math.round(productiveRatio * 100)}%)`, contribution: -penalty });
        score -= penalty;
      }
    }
  }

  // Focus sessions
  if (completionRate > 0) {
    const bonus = Math.round(completionRate * 15);
    positiveFactors.push({ label: `Focus session completion (${Math.round(completionRate * 100)}%)`, contribution: bonus });
    score += bonus;
  }
  if (totalFocusMs > 0) {
    const hours = totalFocusMs / 3_600_000;
    const bonus = Math.min(10, Math.round(hours * 3));
    if (bonus > 0) {
      positiveFactors.push({ label: `Focus duration (${hours.toFixed(1)}h)`, contribution: bonus });
      score += bonus;
    }
  }

  // Tasks completed
  if (completedTasks.length > 0) {
    const bonus = Math.min(15, completedTasks.length * 3);
    positiveFactors.push({ label: `Completed tasks (+${completedTasks.length})`, contribution: bonus });
    score += bonus;
  }

  // Distraction deductions
  if (distractingMs > 1_800_000) { // > 30 mins
    const hours = distractingMs / 3_600_000;
    const penalty = Math.min(25, Math.round(hours * 6));
    negativeFactors.push({ label: `Distracting browsing (${hours.toFixed(1)}h)`, contribution: -penalty });
    score -= penalty;
  }
  if (distractionAttempts > 0) {
    const penalty = Math.min(15, distractionAttempts * 3);
    negativeFactors.push({ label: `Focus blocklist violations (×${distractionAttempts})`, contribution: -penalty });
    score -= penalty;
  }
  if (overdueTasks.length > 0) {
    const penalty = Math.min(15, overdueTasks.length * 4);
    negativeFactors.push({ label: `Overdue tasks (×${overdueTasks.length})`, contribution: -penalty });
    score -= penalty;
  }

  score = Math.max(0, Math.min(100, score));

  // Defaults to 100 on clean slate
  if (totalBrowsingMs === 0 && sessionCount === 0 && allTasks.length === 0) {
    score = 100;
  }

  const rollup: ProductivityRollup = {
    period,
    score,
    positiveFactors,
    negativeFactors,
    productiveMs,
    neutralMs,
    distractingMs,
    computedAt: Date.now(),
  };

  const key = period === 'daily' ? KEYS.ROLLUP_DAILY : KEYS.ROLLUP_WEEKLY;
  await storageSet(key, rollup);
}
