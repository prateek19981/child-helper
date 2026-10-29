export type TalkPrep = {
  lessonId: string;
  conversationId: string;
  prompt: string;
  retry: string;
};

let pending: TalkPrep | null = null;

export function setTalkPrep(next: TalkPrep) {
  pending = next;
}

export function peekTalkPrep(lessonId: string): TalkPrep | null {
  if (!pending || pending.lessonId !== lessonId) return null;
  return pending;
}

export function clearTalkPrep() {
  pending = null;
}

/** Consume prep for this lesson once (clears after read). */
export function takeTalkPrep(lessonId: string): TalkPrep | null {
  const out = peekTalkPrep(lessonId);
  if (out) clearTalkPrep();
  return out;
}
