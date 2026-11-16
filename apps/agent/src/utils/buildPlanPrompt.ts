type PlanPromptParams = {
  projectRoot: string;
  stack: unknown;
  dependenciesInstalled: boolean;
  dependencies: Record<string, string>;
  fileTree: string[];
  lastError?: string | null;
  enhancedPrompt: string;
  prompt: string;
  recentToolResults?: { tool: string; parameters?: Record<string, unknown>; result: string }[];
};

export function buildPlanPrompt({
  projectRoot,
  stack,
  dependenciesInstalled,
  dependencies,
  fileTree,
  lastError,
  enhancedPrompt,
  prompt,
  recentToolResults = [],
}: PlanPromptParams): string {
  const isFixingError = !!lastError;
  const needsInstall = !dependenciesInstalled;

  const recentToolResultsSection = recentToolResults.length > 0
    ? `
## Results From Your Last Tool Calls

You already requested these tool calls on the previous turn. Here are their results —
use this information directly instead of re-requesting the same read_file/grep_search
calls again:

${recentToolResults.map((r, i) => {
      const paramsSummary = r.parameters ? JSON.stringify(r.parameters) : "";
      return `### ${i + 1}. ${r.tool}${paramsSummary ? ` ${paramsSummary}` : ""}\n\n${r.result}`;
    }).join("\n\n")}
`
    : "";

  return `

## Project Context

The project has ALREADY been scaffolded on disk. Do NOT scaffold, re-run "npm create vite",
"tailwindcss init", or any project setup commands. This project already exists on disk.

Project Directory: ${projectRoot}
Stack: ${JSON.stringify(stack)}
Dependencies installed (node_modules present): ${dependenciesInstalled}
Declared dependencies (package.json): ${JSON.stringify(dependencies, null, 2)}

Current file tree:
${fileTree.map((f) => `- ${f}`).join("\n")}
${recentToolResultsSection}
## Your Task

${needsInstall
      ? `Dependencies have NOT been installed yet (node_modules is missing). Your FIRST and ONLY
tool call this turn must be an execute_command call to install dependencies (e.g. "pnpm install"
with args as install, run from the project root). Do not request any other tool calls this turn — you
will get another planning turn afterward, with node_modules confirmed present, to continue with
the user's actual request below.

User's request (to address on a LATER turn, once dependencies are installed): ${enhancedPrompt}\n\nOriginal prompt: ${prompt}`
      : isFixingError
        ? `The previous attempt failed with this error:\n\n${lastError}\n\nInvestigate the relevant file(s) using read_file, diagnose the root cause, then fix it using edit_file or write_file. Do not repeat the exact same change that caused this failure.`
        : `User's request: ${enhancedPrompt}\n\nOriginal prompt: ${prompt}`
    }

## How to work

- You do NOT have the contents of any file yet unless it is shown above under "Results From
  Your Last Tool Calls" — the file tree only shows paths. Use read_file to see a file's
  current contents before deciding how to edit it. Never guess or fabricate what a file
  currently contains.
- This is a single planning turn: every tool call you request now will be executed for you
  AFTERWARDS by a separate execution step, and you will see their results on your NEXT
  planning turn (shown under "Results From Your Last Tool Calls"), not this one.
- You MUST make real, forward progress every turn. If you already have enough information
  (e.g. you've already read the files you need), use write_file/update_file/replace_in_file
  THIS turn to actually implement the request — do not keep reading without ever writing.
- Because of this, prefer requesting a small, focused batch of tool calls per turn rather
  than a long speculative chain of edits you cannot verify yet.
- Prefer replace_in_file or update_file (targeted changes) over write_file for small changes
  to existing files, to avoid accidentally dropping unrelated code.
- Use write_file only for brand new files, or when a file needs to be substantially rewritten.
- Use execute_command only for things that genuinely need a shell command (e.g. installing a
  new npm package). Never use it for project scaffolding.
- Every file you write must contain complete, real, working code. Never use placeholder
  comments like "// your code here" or "// implementation goes here".
- Only when the user's request has been FULLY implemented (code written, not just read) should
  you stop calling tools and respond with a brief plain-text summary. Stopping without having
  written any code is treated as an incomplete task, not a successful completion.

Begin.
    `.trim();
}
