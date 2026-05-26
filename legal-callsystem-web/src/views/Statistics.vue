<template>
  <div class="statistics">
    <h2>数据统计</h2>
    <el-row :gutter="20">
      <el-col :span="8">
        <el-card>
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
        <el-card>
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
        <el-card>
          <template #header>客户统计</template>
          <div class="stat-item">
            <span>客户总数：</span>
            <strong>{{ stats.customers }}</strong>
          </div>
          <div class="stat-item">
            <span>新增客户：</span>
            <strong>{{ stats.newCustomers }}</strong>
          </div>
          <div class="stat-item">
            <span>跟进中：</span>
            <strong>{{ stats.following }}</strong>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-card style="margin-top: 20px">
      <template #header>外呼趋势（近7天）</template>
      <div style="height: 300px; display: flex; align-items: flex-end; justify-content: space-around; padding: 20px;">
        <div v-for="day in trend" :key="day.date" class="trend-bar">
          <div class="bar" :style="{ height: day.calls * 2 + 'px' }"></div>
          <div class="label">{{ day.date }}</div>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const stats = ref({
  totalCalls: 128,
  connected: 45,
  connectRate: 35,
  interested: 12,
  notInterested: 33,
  convertRate: 9,
  customers: 256,
  newCustomers: 18,
  following: 45
})

const trend = ref([
  { date: '02-22', calls: 15 },
  { date: '02-23', calls: 22 },
  { date: '02-24', calls: 18 },
  { date: '02-25', calls: 25 },
  { date: '02-26', calls: 20 },
  { date: '02-27', calls: 12 },
  { date: '02-28', calls: 16 }
])
</script>

<style scoped>
.stat-item {
  padding: 10px 0;
  border-bottom: 1px solid #eee;
  display: flex;
  justify-content: space-between;
}
.stat-item:last-child { border-bottom: none }
.trend-bar {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.bar {
  width: 40px;
  background: #409eff;
  border-radius: 4px 4px 0 0;
  transition: height 0.3s;
}
.label {
  margin-top: 10px;
  font-size: 12px;
  color: #999;
}
</style>