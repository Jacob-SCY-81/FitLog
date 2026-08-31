import http from 'http';

const BASE = 'http://127.0.0.1:3000';

function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function fetchStatic(path) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'GET',
    }, (res) => {
      let bytes = 0;
      res.on('data', (c) => (bytes += c.length));
      res.on('end', () => {
        resolve({ status: res.statusCode, contentType: res.headers['content-type'], bytes });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function runTests() {
  console.log('========================================');
  console.log('  FitLog 自动化测试检核开始');
  console.log('========================================\n');

  let passed = 0;
  let failed = 0;

  function assert(name, condition, extraInfo = '') {
    if (condition) {
      console.log(`✅ [PASS] ${name} ${extraInfo}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${name} ${extraInfo}`);
      failed++;
    }
  }

  // 1. Health Check
  const health = await request('GET', '/api/v1/health');
  assert('后端健康检查', health.status === 200 && health.data.status === 'ok');

  // 2. Auth Flow (dev bypass login)
  const loginRes = await request('POST', '/api/v1/auth/login', { email: 'admin@admin', code: '123456' });
  const token = loginRes.data?.data?.accessToken;
  assert('认证登录流程', loginRes.status === 200 && !!token);

  const authHeaders = { Authorization: `Bearer ${token}` };


  // 3. Exercise List Total
  const exList = await request('GET', '/api/v1/exercises?page=1&limit=10', null, authHeaders);
  const totalExercises = exList.data?.data?.total;
  assert('动作库总数检核 (>=1324)', totalExercises >= 1324, `(当前总数: ${totalExercises})`);

  // 4. Exercise Detail & Instructions
  const exDetail = await request('GET', '/api/v1/exercises/0001', null, authHeaders);
  const detailData = exDetail.data?.data;
  const hasInstructions = Array.isArray(detailData?.instructions) && detailData.instructions.length > 0;
  const hasImages = Array.isArray(detailData?.images) && detailData.images.length > 0;
  assert('动作详情检核 (中文步骤)', hasInstructions, `(${detailData?.instructions?.[0] || '无'})`);
  assert('动作动图路径检核', hasImages, `(${detailData?.images?.[0] || '无'})`);

  // 5. Static GIF Serving
  if (hasImages) {
    const gifUrl = detailData.images[0];
    const gifRes = await fetchStatic(gifUrl);
    assert('动图静态文件可访问性', gifRes.status === 200 && gifRes.contentType.includes('image/gif'), `(大小: ${gifRes.bytes} bytes)`);
  }

  // 6. Muscle & Equipment Filter
  const filterRes = await request('GET', '/api/v1/exercises?muscle=chest&equipment=dumbbell', null, authHeaders);
  const filterCount = filterRes.data?.data?.total || 0;
  assert('多维条件筛选 (胸肌+哑铃)', filterRes.status === 200 && filterCount > 0, `(命中: ${filterCount} 个动作)`);

  // 7. Search Filter
  const searchRes = await request('GET', '/api/v1/exercises?search=俯卧撑', null, authHeaders);
  const searchCount = searchRes.data?.data?.total || 0;
  assert('中文关键词搜索 (俯卧撑)', searchRes.status === 200 && searchCount > 0, `(命中: ${searchCount} 个动作)`);

  // 8. Custom Exercise Create & Delete
  const createRes = await request('POST', '/api/v1/exercises', {
    name: '自动化测试自定义深蹲',
    targetMuscle: 'upper legs',
    equipment: 'barbell',
    notes: '测试备注',
  }, authHeaders);
  const customId = createRes.data?.data?.id;
  assert('自定义动作创建', createRes.status === 201 && !!customId);

  if (customId) {
    const delRes = await request('DELETE', `/api/v1/exercises/${customId}`, null, authHeaders);
    assert('自定义动作删除', delRes.status === 200);
  }

  console.log('\n========================================');
  console.log(`  检核结果汇总: ${passed} 项通过, ${failed} 项失败`);
  console.log('========================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('测试执行异常:', err);
  process.exit(1);
});
