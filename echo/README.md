<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

**Echo monorepo:** Full-stack demo and architecture docs live at the repository root — [`README.md`](../README.md) (zh-CN overview), [`docs/`](../docs/), [`echo/docs/`](./docs/README.md).

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/65016608-3a1d-4138-804a-4052b10282ae

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Optional: set `VITE_DEEPSEEK_API_KEY` in `.env.local` for **local** calls to [DeepSeek](https://api.deepseek.com/) via [`src/api/deepseek.ts`](./src/api/deepseek.ts) (browser exposes the key — use a backend proxy in production).
3. Optional: set `VITE_API_BASE_URL` in `.env.local` to your Echo Platform API root including `/v1` for live feed/matches — see [echo/docs/README.md](./docs/README.md).
4. Run the app:
   `npm run dev`
