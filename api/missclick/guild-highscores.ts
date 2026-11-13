import { ApiRequest, ApiResponse, handleGuildHighscoresRequest } from './_core.js';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  return handleGuildHighscoresRequest(req, res);
}
