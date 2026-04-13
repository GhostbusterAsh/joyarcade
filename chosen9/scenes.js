const scenes = {
  start_phone: {
    text: "\"Is that you?\" A photo from Pankaj blinks on your phone. In the corner: Anuj, half-shadow.",
    choices: [
      { text: "Zoom in and save it", next: "chain_lobby", effect: () => { state.doubtLevel += 1; } },
      { text: "Close it and queue anyway", next: "chain_lobby", effect: () => { state.doubtLevel += 0; } }
    ]
  },

  chain_lobby: {
    text: "Chain game. Easy wins. Your aim feels borrowed.",
    choices: [
      { text: "Keep farming wins", next: "ghost_map", effect: () => { state.doubtLevel += 1; } },
      { text: "Leave early for ghost game", next: "ghost_map", effect: () => { state.doubtLevel += 0; } }
    ]
  },

  ghost_map: {
    text: "Ghost map. Tank room. You crouch behind rusted metal and count breath.",
    choices: [
      { text: "Wait in silence", next: "anuj_tag", effect: () => { state.doubtLevel += 0; } },
      { text: "Peek and reposition", next: "anuj_tag", effect: () => { state.doubtLevel += 1; } }
    ]
  },

  anuj_tag: {
    text: "\"Got you.\" Anuj pulls the curtain aside. Clean tag. No argument.",
    choices: [
      { text: "Admit it", next: "post_match_hall", effect: () => { state.liedAboutAnuj = false; } },
      { text: "Lie: \"You never touched me.\"", next: "lie_commit", effect: () => { state.liedAboutAnuj = true; state.doubtLevel += 2; } }
    ]
  },

  post_match_hall: {
    text: "In the hallway, people laugh, normal, loud. The night can still end here.",
    choices: [
      { text: "Go home", next: "ending_normal", effect: () => { state.doubtLevel = Math.max(0, state.doubtLevel - 1); } },
      { text: "Mention the photo anyway", next: "group_whisper", effect: () => { state.spreadFear = true; state.doubtLevel += 1; } }
    ]
  },

  lie_commit: {
    text: "You repeat it twice so it sounds like memory: \"He missed me.\"",
    choices: [
      { text: "Add: \"Something was wrong with him.\"", next: "group_fear", effect: () => { state.spreadFear = true; state.doubtLevel += 1; } },
      { text: "Keep the lie small", next: "group_whisper", effect: () => { state.spreadFear = false; state.doubtLevel += 1; } }
    ]
  },

  group_whisper: {
    text: "Only two people hear you. They trade a look, then drop it.",
    choices: [
      { text: "Push the story harder", next: "group_fear", effect: () => { state.spreadFear = true; state.doubtLevel += 1; } },
      { text: "Back off", next: "anuj_explains", effect: () => { state.doubtLevel += 0; } }
    ]
  },

  group_fear: {
    text: "The room cools. Jokes stop. Someone says, \"I felt it too.\" You never heard them say that before.",
    choices: [
      { text: "Confirm it: \"Yes, exactly.\"", next: "touch_claim", effect: () => { state.doubtLevel += 1; } },
      { text: "Pretend you said less", next: "touch_claim", effect: () => { state.doubtLevel += 1; } }
    ]
  },

  touch_claim: {
    text: "\"Did he touch you with his left hand?\" someone asks. You answer before thinking.",
    choices: [
      { text: "Say: \"Left hand.\"", next: "anuj_explains", effect: () => { state.doubtLevel += 1; } },
      { text: "Say: \"Right... I think.\"", next: "anuj_explains", effect: () => { state.doubtLevel += 2; } }
    ]
  },

  anuj_explains: {
    text: "Anuj steps into the light. Calm voice. \"Watch my replay. I used my right hand.\"",
    choices: [
      { text: "Accept the replay", next: "mirror_hall", effect: () => { state.doubtLevel = Math.max(0, state.doubtLevel - 1); } },
      { text: "Call it edited", next: "illusion_stairs", effect: () => { state.doubtLevel += 2; } }
    ]
  },

  mirror_hall: {
    text: "In the glass door, your reflection mouths \"left\" while you remember saying \"right.\"",
    choices: [
      { text: "Blink and move on", next: "ending_uncertain", effect: () => { state.doubtLevel += 1; } },
      { text: "Follow the reflection", next: "illusion_stairs", effect: () => { state.doubtLevel += 2; } }
    ]
  },

  illusion_stairs: {
    text: "Stairwell. Footsteps behind you. Then none. A message appears from Pankaj: 'Don't turn around.' It vanishes.",
    choices: [
      { text: "Run downstairs", next: "memory_split", effect: () => { state.doubtLevel += 1; } },
      { text: "Turn around", next: "memory_split", effect: () => { state.doubtLevel += 2; } }
    ]
  },

  memory_split: {
    text: "Two memories overlap: you warned them, or you infected them. Both feel true.",
    choices: [
      { text: "Confess to the group chat", next: "confession", effect: () => { state.liedAboutAnuj = false; state.doubtLevel += 1; } },
      { text: "Double down and accuse Anuj again", next: "spiral_room", effect: () => { state.liedAboutAnuj = true; state.spreadFear = true; state.doubtLevel += 2; } }
    ]
  },

  confession: {
    text: "You type: \"I lied about Anuj.\" Read receipts climb. Then a new voice note arrives: breathing, one tap on metal, left side.",
    choices: [
      { text: "Play the voice note", next: "ending_true", effect: () => { state.doubtLevel += 1; } },
      { text: "Delete chat and sleep", next: "ending_uncertain", effect: () => { state.doubtLevel += 1; } }
    ]
  },

  spiral_room: {
    text: "Everyone repeats your words back to you, slightly wrong each time. By the fifth echo, you believe the worst version.",
    choices: [
      { text: "Keep talking", next: "ending_breakdown", effect: () => { state.doubtLevel += 3; } },
      { text: "Go silent", next: "ending_uncertain", effect: () => { state.doubtLevel += 1; } }
    ]
  },

  ending_normal: {
    text: "Morning. No messages. No rumors. Just a match result and breakfast. You move on.",
    choices: [
      { text: "Restart", next: "start_phone", effect: () => { state.liedAboutAnuj = false; state.spreadFear = false; state.doubtLevel = 0; } }
    ]
  },

  ending_uncertain: {
    text: "You function. You smile. But every right hand looks left for half a second.",
    choices: [
      { text: "Restart", next: "start_phone", effect: () => { state.liedAboutAnuj = false; state.spreadFear = false; state.doubtLevel = 0; } }
    ]
  },

  ending_breakdown: {
    text: "You record your own statement for proof. On playback, it's Anuj's voice saying your lie before you did.",
    choices: [
      { text: "Restart", next: "start_phone", effect: () => { state.liedAboutAnuj = false; state.spreadFear = false; state.doubtLevel = 0; } }
    ]
  },

  ending_true: {
    text: "You admitted the lie. Fear should die. It doesn't. At 2:17 AM, someone taps your door twice—left side, then right.",
    choices: [
      { text: "Restart", next: "start_phone", effect: () => { state.liedAboutAnuj = false; state.spreadFear = false; state.doubtLevel = 0; } }
    ]
  }
};
