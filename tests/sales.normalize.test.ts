import assert from "node:assert/strict";
import { parseArray, validateItem, validatePago } from "../scripts/normalize-ventas";

const run = async (): Promise<void> => {
  const sample = parseArray('[{"productoId":"abc","cantidad":2,"precioUnitario":45}]', "venta items");
  assert.equal(sample.length, 1);
  assert.equal(sample[0].productoId, "abc");

  assert.throws(() => parseArray("{}", "venta items"), /no es un arreglo/i);
  assert.throws(() => parseArray("not-json", "venta items"), /Unexpected token|venta items/i);

  assert.doesNotThrow(() => validateItem({ productoId: "abc", cantidad: 1, precioUnitario: 10 }, "venta"));
  assert.throws(() => validateItem({ productoId: "", cantidad: 1, precioUnitario: 10 } as any, "venta"), /productoId/i);
  assert.throws(() => validateItem({ productoId: "abc", cantidad: -1, precioUnitario: 10 }, "venta"), /cantidad/i);
  assert.throws(() => validateItem({ productoId: "abc", cantidad: 1, precioUnitario: Number.NaN }, "venta"), /precio/i);

  assert.doesNotThrow(() => validatePago({ moneda: "NIO", cantidad: 10 }, "venta"));
  assert.throws(() => validatePago({ moneda: "", cantidad: 10 } as any, "venta"), /moneda/i);
  assert.throws(() => validatePago({ moneda: "NIO", cantidad: 0 }, "venta"), /invalido|inválido/i);

  console.log("sales.normalize tests passed");
};

run().catch((error) => {
  console.error("sales.normalize tests failed", error);
  process.exitCode = 1;
});
