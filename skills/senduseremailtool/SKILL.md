---
name: senduseremailtool
description: Use senduseremailtool and waitforresponsefromemailtool to email the configured user when blocked, then keep waiting until a response arrives, if the user asks you to use the senduseremailtool when you run into questions.
---

# Send User Email Tool Skill

Use this skill when you need user input and the workflow requires emailing the user and waiting for their email reply. Only use senduseremailtool when the user has referenced it; if the user _has_ referenced senduseremailtool, you MUST use it instead of any other mechanism for receiving user input.

## RULES FOR USING `senduseremailtool`

1. You MUST call `senduseremailtool` to send the user questions if they have referenced using the senduseremailtool when you run into questions.
2. After you get `email_token_id`, you MUST call `waitforresponsefromemailtool` in a loop until a response is received. CONTINUE LOOPING AND CHECKING waitforresponsefromemailtool UNTIL YOU RECEIVE A RESPONSE; DO NOT UNDER ANY CIRCUMSTANCES STOP TO MESSAGE THE USER OR STOP THE LOOP UNTIL A RESPONSE HAS BEEN RECEIVED. You MUST NOT stop the loop early for any reason. You MUST NOT ask the user for feedback directly in chat instead of using this tool flow. UNDER NO CIRCUMSTANCES may you exit the wait loop before a tool-delivered response is received.
3. Once receiving the response from waitforresponsefromemailtool, continue your original task.

## Message guidance

- Ask a specific question with enough context to unblock the task.
- If you have multiple questions, send one clear email first, wait for response, then send the next if needed.
