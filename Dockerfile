# Gunakan image resmi Bun sebagai base
FROM oven/bun:1 as base
WORKDIR /usr/src/app

# Copy package.json dan bun.lockb (jika ada)
COPY package.json bun.lockb* ./

# Install dependencies
RUN bun install

# Copy seluruh source code
COPY . .

# Expose port (default 3000)
EXPOSE 3000

# Start command
CMD ["bun", "run", "start"]
