import { FastifyInstance } from "fastify";
import {
	createAdminUser,
	deleteAdminUser,
	getAdminUser,
	listAdminUsers,
	updateAdminUser,
} from "../controllers/admin.users.controller";
import { requireAdmin } from "../middlewares/admin.middleware";

const userIdParamsSchema = {
	type: "object",
	required: ["id"],
	properties: {
		id: { type: "string", pattern: "^[1-9]\\d*$" },
	},
};

export default async function adminUserRoutes(fastify: FastifyInstance) {
	fastify.addHook("onRequest", requireAdmin);

	fastify.get("/", {
		schema: {
			tags: ["Admin Users"],
			description: "Lista usuários com paginação, busca e filtro por papel.",
			security: [{ bearerAuth: [] }],
			querystring: {
				type: "object",
				properties: {
					page: { type: "integer", minimum: 1 },
					limit: { type: "integer", minimum: 1, maximum: 100 },
					search: { type: "string" },
					role: { type: "string", enum: ["USER", "ADMIN"] },
				},
			},
		},
	}, listAdminUsers);

	fastify.get<{ Params: { id: string } }>("/:id", {
		schema: {
			tags: ["Admin Users"],
			description: "Busca um usuário pelo ID.",
			security: [{ bearerAuth: [] }],
			params: userIdParamsSchema,
		},
	}, getAdminUser);

	fastify.post("/", {
		schema: {
			tags: ["Admin Users"],
			description: "Cria um usuário. Apenas administradores podem definir o papel ADMIN.",
			security: [{ bearerAuth: [] }],
			body: {
				type: "object",
				required: ["firstName", "lastName", "email", "password"],
				properties: {
					firstName: { type: "string" },
					lastName: { type: "string" },
					email: { type: "string", format: "email" },
					password: { type: "string", minLength: 6 },
					cpf: { type: "string", nullable: true },
					birthDate: { type: "string", format: "date" },
					phone: { type: "string", nullable: true },
					role: { type: "string", enum: ["USER", "ADMIN"], default: "USER" },
				},
			},
		},
	}, createAdminUser);

	fastify.put<{ Params: { id: string } }>("/:id", {
		schema: {
			tags: ["Admin Users"],
			description: "Atualiza dados, senha ou papel de um usuário.",
			security: [{ bearerAuth: [] }],
			params: userIdParamsSchema,
			body: {
				type: "object",
				properties: {
					firstName: { type: "string" },
					lastName: { type: "string" },
					email: { type: "string", format: "email" },
					password: { type: "string", minLength: 6 },
					cpf: { type: "string", nullable: true },
					birthDate: { type: "string", format: "date", nullable: true },
					phone: { type: "string", nullable: true },
					role: { type: "string", enum: ["USER", "ADMIN"] },
				},
			},
		},
	}, updateAdminUser);

	fastify.delete<{ Params: { id: string } }>("/:id", {
		schema: {
			tags: ["Admin Users"],
			description: "Exclui um usuário sem remover o histórico dos pedidos.",
			security: [{ bearerAuth: [] }],
			params: userIdParamsSchema,
		},
	}, deleteAdminUser);
}
