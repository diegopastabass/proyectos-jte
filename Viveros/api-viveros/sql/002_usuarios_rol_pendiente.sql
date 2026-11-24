-- Registro abierto de usuarios: el rol pasa de char(1) a varchar(4) para admitir 1000
-- (cuenta pendiente, sin acceso). Es idempotente.
ALTER TABLE viveros_tambo_users ALTER COLUMN role TYPE varchar(4);
ALTER TABLE viveros_tambo_users ALTER COLUMN role SET DEFAULT '1000';

-- Para habilitar a un usuario como administrador (alarmas, umbrales):
-- UPDATE viveros_tambo_users SET role = '0' WHERE email = 'correo@ejemplo.cl';
