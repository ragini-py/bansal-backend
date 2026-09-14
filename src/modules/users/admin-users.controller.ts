import type { Request, Response } from "express";
import { requestMeta } from "../../common/request-meta.js";
import type { AccessTokenPayload } from "../../utils/jwt.js";
import * as adminUsersService from "./admin-users.service.js";
import type { UpdateUserInput } from "./admin-users.schemas.js";

export async function list(_req: Request, res: Response): Promise<void> {
  const users = await adminUsersService.listUsers();
  res.json({ users });
}

export async function update(req: Request<{ id: string }>, res: Response): Promise<void> {
  const { sub } = req.user as AccessTokenPayload;
  const user = await adminUsersService.updateUser(req.params.id, sub, req.body as UpdateUserInput, {
    id: sub,
    ...requestMeta(req),
  });
  res.json({ user });
}
