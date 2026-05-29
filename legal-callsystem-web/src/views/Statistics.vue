<template>
  <div class="statistics">
    <h2>数据统计</h2>

    <el-row :gutter="20">
      <el-col :span="8">
        <el-card v-loading="loading">
          <template #header>呼出统计</template>
          <div class="stat-item">
            <span>总外呼数：</span>
            <strong>{{ stats.totalCalls }}</strong>
          </div>
          <div class="stat-item">
            <span>接通数：</span>
            <strong>{{ stats.connected }}</strong>
          </div>
          <div class="stat-item">
            <span>接通率：</span>
            <strong>{{ stats.connectRate }}%</strong>
          </div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card v-loading="loading">
          <template #header>转化统计</template>
          <div class="stat-item">
            <span>有意向：</span>
            <strong>{{ stats.interested }}</strong>
          </div>
          <div class="stat-item">
            <span>无意向：</span>
            <strong>{{ stats.notInterested }}</strong>
          </div>
          <div class="stat-item">
            <span>转化率：</span>
            <strong>{{ stats.convertRate }}%</strong>
          </div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card v-loading="loading">
          <template #header>客户统计</template>
          <div class="stat-item">
            <span>客户总数：</span>
            <strong>{{ stats.totalCustomers }}</strong>
          </div>
          <div class="stat-item">
            <span>新客户：</span>
            <strong>{{ stats.newCustomers }}</strong>
          </div>
          <div class="stat-item">
            <span>跟进中：</span>
            <strong>{{ stats.following }}</strong>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" style="margin-top: 20px">
      <el-col :span="12">
        <el-card v-loading="loading">
          <template #header>任务状态</template>
          <div class="stat-item">
            <span>运行中任务：</span>
            <el-tag type="warning">{{ stats.runningTasks }}</el-tag>
          </div>
          <div class="stat-item">
            <span>已完成任务：</span>
            <el-tag type="success">{{ stats.completedTasks }}</el-tag>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-card style="margin-top: 20px" v-loading="loading">
      <template #header>外呼趋势（近7天）</template>
      <div class="trend-container" v-if="trend.length > 0">
        <div v-for="day in trend" :key="day.date" class="trend-bar">
          <div class="bar-wrapper">
            <div class="bar connected-bar" :style="{ height: Math.max(day.connected * barScale, 2) + 'px' }" :title="'接通: ' + day.connected"></div>
            <div class="bar calls-bar" :style="{ height: Math.max(day.calls * barScale, 2) + 'px' }" :title="'外呼: ' + day.calls"></div>
          </div>
          <div class="label">{{ day.date }}</div>
          <div class="bar-legend">
            <span class="calls-dot"></span>{{ day.calls }}
            <span class="connected-dot"></span>{{ day.connected }}
          </div>
        </div>
      </div>
      <div v-else style="text-align:center;color:#999;padding:40px">
        暂无外呼数据，创建任务并启动后这里会显示趋势
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import axios from 'axios'

const loading = ref(false)

const stats = ref({
  totalCalls: 0, connected: 0, connectRate: 0,
  interested: 0, notInterested: 0, convertRate: 0,
  totalCustomers: 0, newCustomers: 0, following: 0,
  runningTasks: 0, completedTasks: 0,
})

const trend = ref([])

const barScale = computed(() => {
  const maxVal = Math.max(...trend.value.map(d => Math.max(d.calls, d.connected)), 1)
  return Math.min(200 / maxVal, 15)
})

onMounted(async () => {
  loading.value = true
  try {
    const token = localStorage.getItem('token')
    if (!token || token === 'undefined') return
    const headers = { Authorization: `Bearer ${token}` }

    const [overviewRes, trendRes] = await Promise.all([
      axios.get('/statistics/overview', { headers }),
      axios.get('/statistics/trend', { headers, params: { days: 7 } }),
    ])

    if (overviewRes.data) {
      stats.value = { ...stats.value, ...overviewRes.data }
    }
    if (trendRes.data) {
      trend.value = trendRes.data
    }
  } catch (e) {
    console.error('Statistics load error:', e)
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.stat-item {
  padding: 10px 0;
  border-bottom: 1px solid #eee;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.stat-item:last-child { border-bottom: none }
.stat-item strong { font-size: 18px; }

.trend-container {
  display: flex;
  align-items: flex-end;
  justify-content: space-around;
  padding: 20px 10px;
  min-height: 250px;
}
.trend-bar {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
  max-width: 80px;
}
.bar-wrapper {
  display: flex;
  align-items: flex-end;
  gap: 4px;
  height: 200px;
}
.bar {
  width: 20px;
  border-radius: 4px 4px 0 0;
  transition: height 0.5s;
  min-width: 16px;
}
.calls-bar { background: #a0cfff; }
.connected-bar { background: #409eff; }
.label { margin-top: 8px; font-size: 12px; color: #999; }
.bar-legend { font-size: 10px; color: #666; margin-top: 4px; display: flex; gap: 4px; align-items: center; }
.calls-dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #a0cfff; }
.connected-dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #409eff; margin-left: 6px; }
</style>
