export const INITIAL =
  "שלום דן 👋 הגיע הזמן לצ'ק-אין היומי שלך. איך היה היום? תן לי 2 דקות מזמנך 🙏"

export function checkinWithLink(url: string): string {
  return `שלום דן 👋 הצ'ק-אין הערב מוכן: ${url}`
}

export const SNOOZE_FOLLOWUP =
  'אני עדיין כאן 😊 דקה אחת, לא יותר. אתה שווה את זה.'

export const FINAL =
  'בסדר גמור, נח טוב 🌙 מחר נדבר. אני כאן בשבילך.'

export const MORNING_AFTER_SKIP =
  'בוקר טוב דן ☀️ אתמול החמצנו — אין בעיה. היום מתחילים מחדש.'

export const CHECKIN_THANKS =
  'תודה דן 🌿 שמרתי הכל. לילה טוב — כל צעד קדימה חשוב.'

export const SANDBOX_EXPIRY_REMINDER =
  '⚠️ תזכורת: ה-Sandbox של Twilio פג תוקפו בעוד ~12 שעות. שלח "join <קוד>" ל-WhatsApp Sandbox כדי לחדש את החיבור.'
