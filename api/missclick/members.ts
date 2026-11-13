import { ApiRequest, ApiResponse, handleMembersRequest } from './_core.js';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  return handleMembersRequest(req, res);
}
