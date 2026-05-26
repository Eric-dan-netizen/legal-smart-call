<template>
  <div class="dashboard">
    <h2>数据概览</h2>
    <el-row :gutter="20">
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-icon" style="background: #409eff"><Phone /></div>
          <div class="stat-info">
            <div class="stat-value">{{ stats.todayCalls }}</div>
            <div class="stat-label">今日外呼</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-icon" style="background: #67c23a"><CircleCheck /></div>
          <div class="stat-info">
            <div class="stat-value">{{ stats.connectRate }}%</div>
            <div class="stat-label">接通率</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-icon" style="background: #e6a23c"><User /></div>
          <div class="stat-info">
            <div class="stat-value">{{ stats.totalCustomers }}</div>
            <div class="stat-label">客户总数</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-icon" style="background: #f56c6c"><WarningFilled /></div>
          <div class="stat-info">
            <div class="stat-value">{{ stats.blacklistCount }}</div>
            <div class="stat-label">黑名单</div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" style="margin-top: 20px">
      <el-col :span="12">
        <el-card>
          <template #header>最近外呼记录</template>
          <el-table :data="recentCalls" style="width: 100%">
            <el-table-column prop="customerName" label="客户" />
            <el-table-column prop="status" label="状态">
              <template #default="{ row }">
                <el-tag :type="row.status === 'success' ? 'success' : 'danger'">
                  {{ row.status === 'success' ? '已接通' : '未接通' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="duration" label="时长(秒)" />
            <el-table-column prop="createdAt" label="时间" />
          </el-table>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card>
          <template #header>任务状态</template>
          <el-table :data="tasks" style="width: 100%">
            <el-table-column prop="name" label="任务名称" />
            <el-table-column prop="status" label="状态">
              <template #default="{ row }">
                <el-tag>{{ row.status }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="completedCount" label="完成/总数" />
          </el-table>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { Phone, CircleCheck, User, WarningFilled } from '@element-plus/icons-vue'
import axios from 'axios'

const stats = ref({
  todayCalls: 0,
  connectRate: 0,
  totalCustomers: 0,
  blacklistCount: 0
})

const recentCalls = ref([])
const tasks = ref([])

onMounted(async () => {
  try {
    const token = localStorage.getItem('token')
    const headers = { Authorization: `Bearer ${token}` }
    
    // 获取客户统计
    const custRes = await axios.get('/customers', { headers })
    stats.value.totalCustomers = custRes.data.length || 0
    
    // 获取任务
    const taskRes = await axios.get('/calls/tasks', { headers })
    tasks.value = taskRes.data || []
    
    // 模拟今日数据
    stats.value.todayCalls = tasks.value.reduce((sum, t) => sum + (t.completedCount || 0), 0)
    stats.value.connectRate = 35
    stats.value.blacklistCount = 5
  } catch (e) {
    console.error(e)
  }
})
</script>

<style scoped>
.dashboard h2 {
  margin-bottom: 20px;
}
.stat-card {
  display: flex;
  align-items: center;
  padding: 20px;
}
.stat-icon {
  width: 60px;
  height: 60px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 24px;
  margin-right: 15px;
}
.stat-value {
  font-size: 28px;
  font-weight: bold;
}
.stat-label {
  color: #999;
  font-size: 14px;
}
</style>