import {
	seedConfig,
	seedIngredients,
	seedProducts,
	seedRecipes,
	seedSales,
	seedUsers
} from "../../core/data/seed-data";
import type { Identifiable } from "../../core/entities/common";
import type { SystemConfig } from "../../core/entities/config.entity";
import type { Insumo } from "../../core/entities/insumo.entity";
import type { Producto } from "../../core/entities/producto.entity";
import type { Receta } from "../../core/entities/receta.entity";
import type { Usuario } from "../../core/entities/usuario.entity";
import type { Venta } from "../../core/entities/venta.entity";

export class InMemoryDatabase {
	private static instance: InMemoryDatabase;

	public readonly users: Usuario[] = [];
	public readonly ingredients: Insumo[] = [];
	public readonly products: Producto[] = [];
	public readonly recipes: Receta[] = [];
	public readonly sales: Venta[] = [];
	public config: SystemConfig = seedConfig;

	private constructor() {
		this.users.push(...seedUsers);
		this.ingredients.push(...seedIngredients);
		this.products.push(...seedProducts);
		this.recipes.push(...seedRecipes);
		this.sales.push(...seedSales);
		this.config = { ...seedConfig };
	}

	public static getInstance(): InMemoryDatabase {
		if (!InMemoryDatabase.instance) {
			InMemoryDatabase.instance = new InMemoryDatabase();
		}
		return InMemoryDatabase.instance;
	}

	public create<T extends Identifiable>(collection: T[], entity: T): T {
		collection.push(entity);
		return entity;
	}

	public findById<T extends Identifiable>(collection: T[], id: string): T | undefined {
		return collection.find((item) => item.id === id);
	}

	public update<T extends Identifiable>(collection: T[], id: string, data: Partial<T>): T | undefined {
		const item = this.findById(collection, id);
		if (!item) {
			return undefined;
		}
		Object.assign(item, data);
		return item;
	}
}
