import assert from 'node:assert';
import { extractJSON } from '../../background/json-extract.js';

console.log('Testing json-extract.js...');

// 1. Plain object
assert.deepStrictEqual(extractJSON('{"key": "value"}'), { key: 'value' });

// 2. Plain array
assert.deepStrictEqual(extractJSON('[1, 2, "three"]'), [1, 2, 'three']);

// 3. Fenced with ```json
assert.deepStrictEqual(extractJSON('Here is the json:\n```json\n{"score": 90}\n```'), { score: 90 });

// 4. Fenced with ``` (no json tag)
assert.deepStrictEqual(extractJSON('```\n{"level": "safe"}\n```'), { level: 'safe' });

// 5. Leading prose and trailing prose
assert.deepStrictEqual(extractJSON('Analysis complete. Result: {"result": "ok"} Thank you.'), { result: 'ok' });

// 6. Nested braces inside strings
assert.deepStrictEqual(extractJSON('{"text": "this has {nested} braces inside", "num": 42}'), {
  text: 'this has {nested} braces inside',
  num: 42
});

// 7. Escaped quotes inside strings
assert.deepStrictEqual(extractJSON('{"quote": "She said \\"hello\\"", "ok": true}'), {
  quote: 'She said "hello"',
  ok: true
});

// 8. Invalid or empty text returns null
assert.strictEqual(extractJSON('no json here at all'), null);
assert.strictEqual(extractJSON('{"incomplete": '), null);
assert.strictEqual(extractJSON(''), null);
assert.strictEqual(extractJSON(null), null);

console.log('PASS: json-extract.test.js');
