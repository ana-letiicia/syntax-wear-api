import { Prisma } from "@prisma/client";
import bcrypt from "bcrypt";
import { HttpError } from "../utils/http-error";
import { prisma } from "../utils/prisma";
import { z } from "zod";
import { adminUserFiltersSchema, createAdminUserSchema, updateAdminUserSchema } from "../utils/validators";

type AdminUserFilters = z.infer<typeof adminUserFiltersSchema>;
type CreateAdminUser = z.infer<typeof createAdminUserSchema>;
type UpdateAdminUser = z.infer<typeof updateAdminUserSchema>;

const adminUserSelect = {
	id: true,
	firstName: true,
	lastName: true,
	email: true,
	cpf: true,
	phone: true,
	birthDate: true,
	role: true,
	createdAt: true,
} satisfies Prisma.UserSelect;

const mapUniqueConstraintError = (error: unknown): never => {
	if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
		throw new HttpError(409, "Email ou CPF já cadastrado.");
	}
	throw error;
};

export const listAdminUsers = async ({ page, limit, search, role }: AdminUserFilters) => {
	const where: Prisma.UserWhereInput = {};
	if (role) where.role = role;
	if (search) {
		where.OR = [
			{ firstName: { contains: search, mode: "insensitive" } },
			{ lastName: { contains: search, mode: "insensitive" } },
			{ email: { contains: search, mode: "insensitive" } },
		];
	}

	const skip = (page - 1) * limit;
	const [users, total] = await Promise.all([
		prisma.user.findMany({
			where,
			select: adminUserSelect,
			skip,
			take: limit,
			orderBy: { createdAt: "desc" },
		}),
		prisma.user.count({ where }),
	]);

	return {
		data: users,
		total,
		page,
		limit,
		totalPages: Math.ceil(total / limit),
	};
};

export const getAdminUserById = async (id: number) => {
	const user = await prisma.user.findUnique({
		where: { id },
		select: adminUserSelect,
	});
	if (!user) throw new HttpError(404, "Usuário não encontrado.");
	return user;
};

export const createAdminUser = async (data: CreateAdminUser) => {
	const password = await bcrypt.hash(data.password, 10);

	try {
		return await prisma.user.create({
			data: {
				firstName: data.firstName,
				lastName: data.lastName,
				email: data.email,
				password,
				cpf: data.cpf,
				phone: data.phone,
				birthDate: data.birthDate ? new Date(data.birthDate) : undefined,
				role: data.role,
			},
			select: adminUserSelect,
		});
	} catch (error) {
		return mapUniqueConstraintError(error);
	}
};

export const updateAdminUser = async (id: number, data: UpdateAdminUser) => {
	const updatedData: Prisma.UserUpdateInput = {
		firstName: data.firstName,
		lastName: data.lastName,
		email: data.email,
		cpf: data.cpf,
		phone: data.phone,
		birthDate: data.birthDate === undefined
			? undefined
			: data.birthDate === null ? null : new Date(data.birthDate),
		role: data.role,
	};

	if (data.password) updatedData.password = await bcrypt.hash(data.password, 10);

	try {
		return await prisma.$transaction(async (transaction) => {
			const currentUser = await transaction.user.findUnique({
				where: { id },
				select: { role: true },
			});
			if (!currentUser) throw new HttpError(404, "Usuário não encontrado.");

			if (currentUser.role === "ADMIN" && data.role === "USER") {
				const adminCount = await transaction.user.count({ where: { role: "ADMIN" } });
				if (adminCount <= 1) {
					throw new HttpError(409, "Não é possível rebaixar o último administrador.");
				}
			}

			return transaction.user.update({
				where: { id },
				data: updatedData,
				select: adminUserSelect,
			});
		});
	} catch (error) {
		return mapUniqueConstraintError(error);
	}
};

export const deleteAdminUser = async (id: number) => {
	await prisma.$transaction(async (transaction) => {
		const user = await transaction.user.findUnique({
			where: { id },
			select: { role: true },
		});
		if (!user) throw new HttpError(404, "Usuário não encontrado.");

		if (user.role === "ADMIN") {
			const adminCount = await transaction.user.count({ where: { role: "ADMIN" } });
			if (adminCount <= 1) {
				throw new HttpError(409, "Não é possível excluir o último administrador.");
			}
		}

		await transaction.order.updateMany({
			where: { userId: id },
			data: { userId: null },
		});
		await transaction.user.delete({ where: { id } });
	});
};
