// src/bot/types.ts

import { Context } from 'telegraf';
import type { SceneContext, SceneSessionData } from 'telegraf/typings/scenes';

export interface MySceneSession extends SceneSessionData {
  state: Record<string, any>;
  cursor?: number;
}

export interface BotContext extends Context {
  // Telegraf session (any, chunki ko‘p narsa bo‘lishi mumkin)
  session: {
    __scenes?: MySceneSession;
  } & Record<string, any>;

  // SceneContext faqat MySceneSession bilan ishlaydi
  scene: SceneContext<MySceneSession>;
}
