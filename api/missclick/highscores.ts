import { ApiRequest, ApiResponse, handleCharacterHighscoresRequest } from './_core.js';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  return handleCharacterHighscoresRequest(req, res);
}
