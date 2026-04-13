const NUDGES = [
  "You've already proven you can wait. Keep going.",
  "Every minute off-screen is a minute invested in yourself.",
  "Your future self will thank you for closing this right now.",
  "The urge passes. It always does. Give it 60 seconds.",
  "What were you about to do before you picked up your phone?",
  "You set this limit for a reason. Trust that version of you.",
  "This app will still be here tomorrow. Your time won't.",
  "One override today becomes a habit tomorrow.",
  "You're stronger than a notification.",
  "The best things in your day happen off-screen.",
  "Think about how good it felt the last time you resisted.",
  "You don't need more screen time. You need more free time.",
  "Your attention is the most valuable thing you own.",
  "This is the moment where discipline becomes freedom.",
  "Put the phone down. Go do something that makes you proud.",
  "Screen time doesn't recharge you. Rest does.",
  "Every limit you respect builds a stronger you.",
  "What would you tell a friend who asked to override right now?",
  "The app is designed to keep you hooked. You're designed to be free.",
  "You've gone this long. Don't reset the streak now.",
  "Boredom is where creativity begins. Sit with it.",
  "No one ever regretted spending less time on their phone.",
  "You're not missing out. You're opting in to real life.",
  "This feeling of wanting more will pass in under 2 minutes.",
  "Your eyes, your posture, your sleep — they all benefit when you stop.",
  "An override costs more than credits. It costs your momentum.",
  "You made a commitment to yourself. Honor it.",
  "Close this screen and take three deep breaths instead.",
  "The people around you deserve your full attention.",
  "Small wins compound. This is one of them.",
  "How did you feel the last time you overused this app?",
  "Replace the scroll with a walk. Even 5 minutes counts.",
  "You're building a habit right now. Make it the right one.",
  "If this app disappeared tomorrow, what would you do instead? Go do that.",
  "Progress isn't about being perfect. It's about not giving in every time.",
  "Your brain needs a break from stimulation. Give it one.",
  "You're not avoiding fun. You're choosing better fun.",
  "The discomfort you feel is growth happening in real time.",
  "Ask yourself: will this override make my day better or just longer?",
  "Every time you respect a limit, you level up.",
  "Reaching your limit means the system is working. Let it work.",
  "You don't owe this app your evening.",
  "Think of one thing you've been putting off. Go do that instead.",
  "Your screen time today is already enough. Trust the number.",
  "Overrides are for emergencies, not for boredom.",
  "The scroll never ends. But your day does.",
  "You chose to set limits because unlimited wasn't working.",
  "Right now, someone you love would rather have your attention.",
  "This is the hard part. And you're doing it.",
  "Tomorrow you'll be glad you stopped today.",
];

export function getRandomNudge(): string {
  return NUDGES[Math.floor(Math.random() * NUDGES.length)];
}

export function getDailyNudge(): string {
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
  );
  return NUDGES[dayOfYear % NUDGES.length];
}

export default NUDGES;
