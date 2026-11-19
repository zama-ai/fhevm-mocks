// The workspace's own ESLint rules, as one local plugin, `fhevm-devex`. eslint.base.mjs (the policy layer of NR-46)
// decides which of them apply and at what severity; this file only defines them.

/**
 * A generation name in a comment: `v13`, `v13.0`, `v14.1` (below 1.0, `v<minor>` and an optional patch), or `v1.0`,
 * `v1.1` (from 1.0 on, `v<major>.<minor>`). The same names as fhevm-npm/base/generation-names.ts, plus the patch
 * suffix a comment adds when it names a release of a generation.
 *
 * The guards keep it to whole words: `updateV13ToV14`, `v13BootstrapConfig`, Node `v22.23.5` and a tag such as
 * `v0.14.4` do not match. Hardhat `v2`/`v3` and extraData `v1`/`v2` carry no minor, so they do not match either.
 */
const GENERATION_NUMBER = /(?<![A-Za-z0-9_$.])v(?:1\d(?:\.\d+)?|[1-9]\.\d+)(?![A-Za-z0-9_])/g;

/** Text between backticks is a quoted value (R-05, case 4): an identifier, a path, a package name, a tag. */
const BACKTICK_SPAN = /`[^`\n]*`/g;

/**
 * The header a generator writes as a file's first comment. A generated file is fixed at its source (R-05, case 1),
 * and the copy may name its own generation, as the cleartext-config faces do ("The v14 TypeScript face").
 */
const GENERATED_HEADER = /\bAUTO-GENERATED\b|\bDO NOT EDIT\b|@generated\b/;

/** @type {import('eslint').Rule.RuleModule} */
const noGenerationNumber = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Disallow naming a cleartext generation by its number (v13, v14.0, v1.0) in a comment; use the R-05 notation.',
    },
    schema: [
      {
        type: 'object',
        properties: {
          // Regular-expression sources. A match that lies inside a match of one of these is allowed, for the
          // R-05 cases that a pattern can recognise, such as a past-tense fact: "v14 added".
          allow: { type: 'array', items: { type: 'string' } },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      generationNumber:
        "'{{name}}' names a generation by its number. Write the notation (`<vN>`, `<vN-1>`, `<N>`), put a value " +
        'the code needs in backticks, or keep a past-tense fact about one release with a disable comment (R-05).',
    },
  },

  create(context) {
    const allow = (context.options[0]?.allow ?? []).map((source) => new RegExp(source, 'g'));
    const sourceCode = context.sourceCode;

    return {
      Program() {
        const comments = sourceCode.getAllComments();
        if (comments.length > 0 && GENERATED_HEADER.test(comments[0].value)) return;
        for (const comment of comments) {
          // `comment.value` excludes the delimiters: `//` and `/*` are both two characters long.
          const valueStart = comment.range[0] + 2;
          // Blank the quoted spans in place, so every index still points at the same character.
          const text = comment.value.replace(BACKTICK_SPAN, (span) => ' '.repeat(span.length));
          const allowed = allowedRanges(comment.value, allow);

          for (const match of text.matchAll(GENERATION_NUMBER)) {
            const start = match.index;
            const end = start + match[0].length;
            if (allowed.some(([from, to]) => from <= start && end <= to)) continue;
            context.report({
              loc: {
                start: sourceCode.getLocFromIndex(valueStart + start),
                end: sourceCode.getLocFromIndex(valueStart + end),
              },
              messageId: 'generationNumber',
              data: { name: match[0] },
            });
          }
        }
      },
    };
  },
};

/** The [start, end) ranges of `text` that one of the `allow` patterns matches. */
function allowedRanges(text, patterns) {
  const ranges = [];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) ranges.push([match.index, match.index + match[0].length]);
  }
  return ranges;
}

export default {
  meta: { name: 'fhevm-devex' },
  rules: { 'no-generation-number': noGenerationNumber },
};
