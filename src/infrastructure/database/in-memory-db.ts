import type {
	Identifiable,
	Insumo,
	Producto,
	Receta,
	Usuario,
	Venta
} from "../../core/entities/types";

export class InMemoryDatabase {
	private static instance: InMemoryDatabase;

	public readonly users: Usuario[] = [];
	public readonly ingredients: Insumo[] = [];
	public readonly products: Producto[] = [];
	public readonly recipes: Receta[] = [];
	public readonly sales: Venta[] = [];

	private constructor() {}

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
