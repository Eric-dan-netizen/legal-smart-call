<template>
  <div class="dashboard">
    <h2>数据概览</h2>
    <p style="color: green; font-size: 18px;">Dashboard 渲染正常</p>

    <el-row :gutter="20">
      <el-col :span="6" v-for="card in cards" :key="card.label">
        <el-card class="stat-card">
          <div class="stat-icon" :style="{ background: card.color }">
            <component :is="card.icon" />
          </div>
          <div class="stat-info">
            <div class="stat-value">{{ card.value }}</div>
            <div class="stat-label">{{ card.label }}</div>
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
            <el-table-column prop="status" label="状态" />
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
            <el-table-column label="完成/总数">
              <template #default="{ row }">
                {{ row.completedCount || 0 }}/{{ row.totalCount || 0 }}
              </template>
            </el-table-column>
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

const cards = ref([
  { label: '今日外呼', value: 0, icon: Phone, color: '#409eff' },
  { label: '接通率', value: '0%', icon: CircleCheck, color: '#67c23a' },
  { label: '客户总数', value: 0, icon: User, color: '#e6a23c' },
  { label: '黑名单', value: 0, icon: WarningFilled, color: '#f56c6c' },
])

const recentCalls = ref([])
const tasks = ref([])

onMounted(async () => {
  try {
    const token = localStorage.getItem('token')
    if (!token || token === 'undefined') {
      console.warn('未登录或 token 无效，请重新登录')
      return
    }
    const headers = { Authorization: `Bearer ${token}` }

    const custRes = await axios.get('/customers', { headers })
    const custData = Array.isArray(custRes.data) ? custRes.data : []
    const totalCustomers = Array.isArray(custData[0]) ? custData[1] : (custData.length || 0)
    cards.value[2].value = totalCustomers

    const taskRes = await axios.get('/calls/tasks', { headers })
    const taskData = Array.isArray(taskRes.data) ? taskRes.data : []
    const taskList = Array.isArray(taskData[0]) ? taskData[0] : taskData
    tasks.value = taskList

    cards.value[0].value = taskList.reduce((sum, t) => sum + (t.completedCount || 0), 0)
    cards.value[1].value = '35%'
    cards.value[3].value = 5
  } catch (e) {
    console.error('Dashboard load error:', e)
  }
})
</script>

<style scoped>
.dashboard h2 { margin-bottom: 20px; }
.stat-card { display: flex; align-items: center; padding: 20px; }
.stat-icon {
  width: 60px; height: 60px; border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-size: 24px; margin-right: 15px;
}
.stat-value { font-size: 28px; font-weight: bold; }
.stat-label { color: #999; font-size: 14px; }
</style>
