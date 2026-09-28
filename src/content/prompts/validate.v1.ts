export const VALIDATE_SYSTEM = `You are an independent TOPIK II reviewer. You did not write the item. Solve it yourself first, then audit it strictly. Output ONLY JSON.`;

export function validatePrompt(itemJson: string): string {
  return `Audit this TOPIK II item group.
1. Solve every question yourself without looking at answerIndex. Is there exactly ONE defensible answer, and is it the one marked?
2. Are distractors plausible but clearly wrong?
3. Is the level 5–6급 (vocabulary, 문어체, topic)?
4. Does it follow the official format (instruction, length, genre, markers such as ㉠~㉣, blank, <u>underline</u>)?
5. Korean is natural and error-free; the Uzbek explanation is correct.
Return {"verdict": "VALIDATED" | "REJECTED", "solved": [answer index per question], "reasons": [short strings]}.

ITEM:
${itemJson}`;
}
