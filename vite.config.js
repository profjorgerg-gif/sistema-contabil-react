import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// "base: './'" faz o build funcionar em qualquer subpasta do GitHub Pages
// (ex.: usuario.github.io/nome-do-repositorio/), sem precisar configurar
// o nome do repositório aqui dentro.
export default defineConfig({
  plugins: [react()],
  base: "./",
});
