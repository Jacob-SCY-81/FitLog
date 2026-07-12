import app from './app.js';
import config from './config/index.js';

app.listen(config.port, () => {
  console.log(`[FitLog] Server running on http://localhost:${config.port}`);
  console.log(`[FitLog] Email mode: ${config.emailMode}`);
});
