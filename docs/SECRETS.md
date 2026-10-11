# Secrets handling

- No secret is stored in the repo. `.env*` is gitignored (only `.env.example` is tracked).
- **OpenAI key**: lives in AWS Secrets Manager (`wv/openai-api-key`), read by the story Lambda at cold start. Set it with
  `aws secretsmanager put-secret-value --secret-id wv/openai-api-key --secret-string "$OPENAI_API_KEY"`. Never put it in CDK context, Lambda env vars or `VITE_*`.
- **ElevenLabs keys** (`ELEVENLABS_API_KEY`, `ELEVENLABS_API_KEY_SFX`): build-time tools only (`tools/gen_music.py`, `tools/gen_sfx.py`), read from the process environment; never imported by `src/` or copied into `public/`/`dist/`.
- **GitHub push**: use a credential helper that reads `GITHUB_PUSH_TOKEN` from the environment; never embed a token in a remote URL.
  `git config --global credential.helper '!f(){ test "$1" = get && echo username=x-access-token && echo "password=$GITHUB_PUSH_TOKEN"; }; f'`
- Rotate any key that was ever pasted into chat, a log or a URL.
