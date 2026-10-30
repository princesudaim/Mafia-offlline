# Werewolf APK recovery notes

The Drive archive `were.zip` contains `base.apk`, an arm64 split, language and display-density splits. The arm64 split contains `libapp.so` and `libflutter.so`; unlike the earlier base APK, it includes the compiled Flutter application.

- base.apk SHA-256: `c30e7e48c06efbb9016ccc9494465b1530398b030b5dc72ad5b289eee35dd62a`
- arm64 split SHA-256: `d50e11a75fce64f7448ad9fa9cb8d789049f961c6f1368c765a12c2ce40b457b`
- The base APK includes role illustrations, audio, and other Flutter assets.
- The Flutter Dart application is ahead-of-time compiled into ARM64 native code, not the original Dart source. Strings and asset names can be recovered, but do not by themselves describe complete implementation or interaction rules. A native APK cannot simply be deployed to GitHub Pages as a PWA.
- This repository currently contains a separate Mafia PWA; it is not an exact recreation. Do not deploy it as the recovered Werewolf game.

## Role-action names found in compiled code

`bodyguard_action`, `charmer_action`, `chef_action`, `detective_action`, `doctor_action`, `gambler_action`, `hypnotist_wolf_action`, `istihbarat_action`, `journalist_action`, `lone_wolf_action`, `mayor_action`, `medyum_action`, `mind_flayer_action`, `necromancer_action`, `police_action`, `rabid_werewolf_action`, `raven_action`, `seer_action`, `serial_killer_action`, `strong_wolf_action`, `survivor_action`, `tellal_action`, `templar_action`, `thief_action`, `vigilante_action`, `visitor_action`, `werewolf_action`, `white_werewolf_action`, `wolf_pup_action`

## Recoverable English descriptions

These are strings from the binary, not proof of the complete behavior. Some rules may vary by settings or depend on interactions not captured here.

- Each night, bet on who will be executed the next day. On nights you gamble, you protect yourself and cannot be killed. Two correct predictions and you escape the village victorious! But one wrong guess brings your creditors, and you die the following night unless saved.
- Each night, choose one player to learn their true role. Use this information to guide the village, but be careful not to reveal yourself to the werewolves.
- Each night, choose one player to protect from werewolf attacks. You cannot protect the same player two nights in a row, but you can protect yourself.
- Each night, one player can recognize you and learn who you are.
- Each night, visit another player. If you visit a werewolf or serial killer, or if the player you visit is attacked that night, you die. Use visits strategically to gather information.
- Each night, you and your werewolf teammates vote to kill a villager. Your goal is to eliminate all non-werewolves without getting caught.
- Each night, you can detain a player to block their role action for that night. You cannot detain the same player two nights in a row.
- The game consists of three phases: night phase, day phase, and voting phase. Throughout this process, the phone is passed around among players with the app's guidance, and each player performs the required actions on the screen when it comes to them.
- You appear as a werewolf and vote with them, but you are actually playing solo. If the werewolves win, you lose! Your goal is to be the last one alive, betraying everyone.
- You are a simple villager with no special abilities. Use your wits to find the werewolves through discussion and vote to eliminate them before they kill everyone.
- You are a villager who cannot speak during the entire game. You can only communicate through gestures and voting. Use your observations wisely.
- You have holy water. At night, choose a player and use the holy water. If the target is a Werewolf, they die. If the target is a villager or neutral, the target survives but you are killed by fellow templars for misusing the water. You can only use this ability once per game.
- You prepare a feast at night and invite 2 players to your table. If both are from the same team, dinner goes smoothly. If they are from different teams, you sense tension at the table.
- You put your life on the line. Every night you protect a villager. If your protected target is attacked with lethal force that night, they survive, but you sacrifice your life in their place.
- You work alone and kill one player each night. Your goal is to be the last one standing. You appear as a villager to the Seer, making you hard to detect.

## Next steps

Reconstruct game flow and role interactions from the native code and observed game behavior; design and implement equivalent web state, UI, assets, and offline storage; test each role and interaction against the original before publishing. A build signed for Android cannot run directly in a browser. Screenshots, recordings, or access to the original running game would help verify fidelity.
