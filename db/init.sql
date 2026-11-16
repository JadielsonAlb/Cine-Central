CREATE TABLE IF NOT EXISTS usuarios (
  id            SERIAL PRIMARY KEY,
  username      VARCHAR(100) NOT NULL UNIQUE,
  password_hash TEXT         NOT NULL
);

CREATE TABLE IF NOT EXISTS pedidos (
  id         SERIAL PRIMARY KEY,
  usuario_id INT         NOT NULL REFERENCES usuarios(id),
  show_id    INT         NOT NULL,
  status     VARCHAR(20) NOT NULL DEFAULT 'NO_CARRINHO'
             CHECK (status IN ('NO_CARRINHO', 'RESERVADO', 'CANCELADO'))
);

CREATE TABLE IF NOT EXISTS pool (
  id       INT PRIMARY KEY CHECK (id = 1),
  total    INT NOT NULL,
  ocupadas INT NOT NULL DEFAULT 0,
  CHECK (ocupadas >= 0 AND ocupadas <= total)
);

INSERT INTO pool (id, total, ocupadas) VALUES (1, 100, 0) ON CONFLICT DO NOTHING;