import { FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import bcrypt from "bcrypt";
import { buildApp } from "../src/app";
import { prisma } from "../src/utils/prisma";

vi.mock("bcrypt", () => ({
	default: {
		hash: vi.fn().mockResolvedValue("$2b$10$hashedpassword"),
		compare: vi.fn(),
	},
}));

vi.mock("../src/utils/prisma", () => ({
	prisma: {
		user: {
			create: vi.fn(),
			findUnique: vi.fn(),
			findMany: vi.fn(),
			count: vi.fn(),
			update: vi.fn(),
			delete: vi.fn(),
		},
		order: {
			updateMany: vi.fn(),
		},
		$transaction: vi.fn(),
	},
}));

describe("Admin users routes", () => {
	let app: FastifyInstance;
	let adminToken: string;

	beforeAll(async () => {
		app = await buildApp();
		adminToken = app.jwt.sign({ userId: 1 });
	});

	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(prisma.user.findUnique).mockResolvedValue({
			id: 1,
			role: "ADMIN",
		} as never);
	});

	afterAll(async () => {
		await app.close();
	});

	const adminHeaders = () => ({ authorization: `Bearer ${adminToken}` });

	it("bloqueia usuários sem autenticação", async () => {
		const response = await app.inject({ method: "GET", url: "/admin/users" });

		expect(response.statusCode).toBe(401);
		expect(prisma.user.findMany).not.toHaveBeenCalled();
	});

	it("lista usuários sem retornar hashes de senha", async () => {
		vi.mocked(prisma.user.findMany).mockResolvedValue([{
			id: 2,
			firstName: "Ana",
			lastName: "Silva",
			email: "ana@example.com",
			cpf: null,
			phone: null,
			birthDate: null,
			role: "USER",
			createdAt: new Date("2026-01-01T00:00:00.000Z"),
		}] as never);
		vi.mocked(prisma.user.count).mockResolvedValue(1 as never);

		const response = await app.inject({
			method: "GET",
			url: "/admin/users?page=1&limit=10&role=USER",
			headers: adminHeaders(),
		});

		expect(response.statusCode).toBe(200);
		expect(response.json().data[0]).not.toHaveProperty("password");
		expect(response.json().total).toBe(1);
	});

	it("cria usuários com senha hash e nunca a inclui na resposta", async () => {
		vi.mocked(prisma.user.create).mockResolvedValue({
			id: 2,
			firstName: "Ana",
			lastName: "Silva",
			email: "ana@example.com",
			cpf: null,
			phone: null,
			birthDate: null,
			role: "USER",
			createdAt: new Date("2026-01-01T00:00:00.000Z"),
		} as never);

		const response = await app.inject({
			method: "POST",
			url: "/admin/users",
			headers: adminHeaders(),
			payload: {
				firstName: "Ana",
				lastName: "Silva",
				email: "ana@example.com",
				password: "senha-segura",
			},
		});

		expect(response.statusCode).toBe(201);
		expect(vi.mocked(bcrypt.hash)).toHaveBeenCalledWith("senha-segura", 10);
		expect(vi.mocked(prisma.user.create).mock.calls[0][0].data.password).toBe("$2b$10$hashedpassword");
		expect(response.json()).not.toHaveProperty("password");
	});

	it("remove usuário sem apagar os pedidos vinculados", async () => {
		vi.mocked(prisma.user.findUnique)
			.mockResolvedValueOnce({ id: 1, role: "ADMIN" } as never)
			.mockResolvedValueOnce({ role: "USER" } as never);
		vi.mocked(prisma.user.count).mockResolvedValue(2 as never);
		const transaction = prisma as never;
		(prisma.$transaction as unknown as ReturnType<typeof vi.fn>).mockImplementation(
			async (callback: (tx: typeof prisma) => Promise<unknown>) => callback(transaction),
		);

		const response = await app.inject({
			method: "DELETE",
			url: "/admin/users/2",
			headers: adminHeaders(),
		});

		expect(response.statusCode).toBe(204);
		expect(prisma.order.updateMany).toHaveBeenCalledWith({
			where: { userId: 2 },
			data: { userId: null },
		});
		expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 2 } });
	});

	it("impede a exclusão do último administrador", async () => {
		vi.mocked(prisma.user.findUnique)
			.mockResolvedValueOnce({ id: 1, role: "ADMIN" } as never)
			.mockResolvedValueOnce({ role: "ADMIN" } as never);
		vi.mocked(prisma.user.count).mockResolvedValue(1 as never);
		(prisma.$transaction as unknown as ReturnType<typeof vi.fn>).mockImplementation(
			async (callback: (tx: typeof prisma) => Promise<unknown>) => callback(prisma),
		);

		const response = await app.inject({
			method: "DELETE",
			url: "/admin/users/1",
			headers: adminHeaders(),
		});

		expect(response.statusCode).toBe(409);
		expect(prisma.user.delete).not.toHaveBeenCalled();
	});
});
