import { FastifyReply, FastifyRequest } from "fastify";
import {
	createAdminUser as createAdminUserRecord,
	deleteAdminUser as deleteAdminUserRecord,
	getAdminUserById as findAdminUser,
	listAdminUsers as findAdminUsers,
	updateAdminUser as updateAdminUserRecord,
} from "../services/admin.users.service";
import {
	adminUserFiltersSchema,
	createAdminUserSchema,
	updateAdminUserSchema,
} from "../utils/validators";

export const listAdminUsers = async (request: FastifyRequest, reply: FastifyReply) => {
	const filters = adminUserFiltersSchema.parse(request.query);
	return reply.send(await findAdminUsers(filters));
};

export const getAdminUser = async (
	request: FastifyRequest<{ Params: { id: string } }>,
	reply: FastifyReply,
) => {
	const id = Number(request.params.id);
	return reply.send(await findAdminUser(id));
};

export const createAdminUser = async (request: FastifyRequest, reply: FastifyReply) => {
	const data = createAdminUserSchema.parse(request.body);
	return reply.status(201).send(await createAdminUserRecord(data));
};

export const updateAdminUser = async (
	request: FastifyRequest<{ Params: { id: string } }>,
	reply: FastifyReply,
) => {
	const id = Number(request.params.id);
	const data = updateAdminUserSchema.parse(request.body);
	return reply.send(await updateAdminUserRecord(id, data));
};

export const deleteAdminUser = async (
	request: FastifyRequest<{ Params: { id: string } }>,
	reply: FastifyReply,
) => {
	const id = Number(request.params.id);
	await deleteAdminUserRecord(id);
	return reply.status(204).send();
};
