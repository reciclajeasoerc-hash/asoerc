// Fecha del negocio en zona horaria de Colombia (evita que después de las 7pm guarde "mañana").
const hoy = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
module.exports = { hoy };
