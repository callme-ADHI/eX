# DIAGNOSIS: Root Cause of Uniform 93 Score & Templated AI Summary

### 1. Root Cause of Uniform 93 Scores (Grade A)
- **Missing Response Headers in Content Scripts**: Content scripts cannot inspect HTTP response headers directly; `headers: {}` is passed by default. Consequently, all 10 Hardening parameters fail universally (no CSP, no HSTS, no X-Frame-Options, no X-Content-Type-Options), producing an identical 67% Hardening subscore on every site.
- **Unweighted Default Bias**: For benign or uninspected sites, Identity (100%), Content (100%), Privacy (100%), and Permissions (100%) saturate at 100% because unobserved features default to pass (score 100). The linear weighted average of (100, 92, 67, 100, 100, 100) mathematically converges to 92.8 -> 93 on almost all sites.
- **Absence of Reputation Prior**: Known giants (Google, CNN) and brand-new unranked domains receive the exact same base score because no domain rank or age prior (Tranco / RDAP) was integrated into the baseline probability.

### 2. Why the AI Security Assessment Felt Synthetic
- **LLM Call Gate**: In `src/background/orchestrator.ts`, `sitePhish` LLM was gated behind `tier0Score >= 20 || features?.hasPasswordInput`. Because standard sites had tier0Score = 0, the LLM was **never called** (0% call rate on clean sites).
- **Template Fallback Dominance**: When the LLM was skipped, `OverviewTab.tsx` rendered the hardcoded template: `"High trust rating (93/100, Grade A)..."`, while simultaneously displaying the top 3 failing header checks as "Top Security Observations". This created contradictory text praising security while flagging missing fundamental headers.

### 3. Cross-Tab Stale State & Leaks
- **Global Cache Collision**: `orchestrator.ts` used `siteCacheKey(hostname, simpleHash(features))` in global storage. Switching tabs or opening duplicate tabs shared cached verdicts across distinct navigations without tracking tab navigation IDs (`navId`).
- **No Navigation Lifecycle Invalidation**: When a tab navigated to a new URL, asynchronous responses from prior slower network scans were written back without checking if the user had moved on.
