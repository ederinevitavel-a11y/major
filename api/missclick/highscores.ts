import { ApiRequest, ApiResponse, handleCharacterHighscoresRequest } from './_core';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  return handleCharacterHighscoresRequest(req, res);
}
