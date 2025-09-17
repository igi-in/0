---

# Redis & Postgres CLI Setup (Interactive)

Panduan cepat untuk setup `redis-cli` lokal, `pgcli` Postgres, dan log styling.

---

## 🔹 Redis CLI (lokal, ARM/64-bit compatible)

```bash
# 1. Install dependency
sudo apt update && sudo apt install build-essential tcl -y

# 2. Download dan ekstrak Redis
cd /app
mkdir -p local/bin
curl -O https://download.redis.io/redis-stable.tar.gz
tar xzvf redis-stable.tar.gz
cd redis-stable

# 3. Build hanya redis-cli
make redis-cli

# 4. Copy ke folder lokal
cp src/redis-cli ../local/bin/

# 5. Tes binary
redis-cli --version
file redis-cli
```

> Harus muncul: `ELF 64-bit LSB executable, ARM aarch64` jika di ARM64.

```bash
# 6. Tes koneksi Redis server
redis-cli -h redis.redis -p 6379 ping
redis-cli -h redis.redis -p 6379 info memory
redis-cli -h redis.redis -p 6379 info stats
```

---

## 🔹 Postgres CLI (`pgcli`)

```bash
# 1. Install pgcli
sudo apt-get install pgcli -y

# 2. Connect ke database
pgcli postgres://postgres:postgres@postgres.postgres:5432/app
```

---

## 🔹 Log Styling (Realtime, warna)

```bash
# Install ccze
sudo apt-get install ccze -y

# Realtime update logs
tail -f s.log | ccze -A

# Realtime + full file
cat s.log | ccze -A && tail -f s.log | ccze -A
```

---

