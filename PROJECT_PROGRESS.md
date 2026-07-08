Nimbus Core progress

Current version: 27-sourceboost.5-auto-batch

Fixed the previous failure where AutoScan tried to seed 1000 sources into D1 during the same Worker invocation. The source catalog now stays in code and the UI automatically distributes the scan over multiple safe invocations from one button press.
