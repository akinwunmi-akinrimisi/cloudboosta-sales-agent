# MERGE: closing-strategies.md
## Type: Find and Replace
## Priority: Quick fix — 2 minutes

### What to change
Replace all instances of "Sarah" with "John" throughout `closing-strategies.md`.
This includes the document title, body text, example scripts, and key phrases.

### Claude Code Prompt
```
Open closing-strategies.md and perform a global find-and-replace:

1. Replace "Sarah's" with "John's" (possessive)
2. Replace "Sarah" with "John" (standalone)
3. Replace "she" with "he" where it refers to the agent
4. Replace "her" with "his" where it refers to the agent
5. Update the document header from "Sarah's Closing Strategy System" 
   to "John's Closing Strategy System"

Do NOT change any other content — strategies, persona detection, 
tracking SQL, or selection algorithm remain identical.

Verify: grep -i "sarah" closing-strategies.md should return 0 results after.
```
