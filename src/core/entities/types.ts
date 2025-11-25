export interface Identifiable {
	id: string;
}

export interface Insumo extends Identifiable {
	nombre: string;
	unidad: string;
	stock: number;
	costoPromedio: number;
}

export interface RecetaItem {
	insumoId: string;
	cantidad: number;
}

export interface Receta extends Identifiable {
	productoId: string;
	items: RecetaItem[];
	costoManoObra?: number;
}

export interface VentaPago {
	moneda: string;
	cantidad: number;
	tasa?: number;
}

export interface VentaItem {
	productoId: string;
	cantidad: number;
	precioUnitario: number;
}

export interface Venta extends Identifiable {
	totalNIO: number;
	pagos: VentaPago[];
	items: VentaItem[];
	fecha?: string;
}

export interface SystemConfig {
	tasaCambio: number;
}

export interface Producto extends Identifiable {
	nombre: string;
	stockDisponible: number;
	precioUnitario?: number;
	precioVenta?: number;
}

export interface Usuario extends Identifiable {
	nombre: string;
	rol: string;
}
