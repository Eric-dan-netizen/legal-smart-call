<template>
  <div class="tasks">
    <div class="header">
      <h2>外呼任务</h2>
      <el-button type="primary" @click="showAddDialog = true">+ 创建任务</el-button>
    </div>

    <el-card>
      <el-table :data="tasks" style="width: 100%">
        <el-table-column prop="name" label="任务名称" />
        <el-table-column prop="scriptId" label="话术ID" />
        <el-table-column prop="status" label="状态">
          <template #default="{ row }">
            <el-tag :type="statusType[row.status]">{{ statusText[row.status] }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="scheduleTime" label="计划时间" />
        <el-table-column label="进度">
          <template #default="{ row }">
            {{ row.completedCount }}/{{ row.totalCount }}
          </template>
        </el-table-column>
        <el-table-column label="成功率">
          <template #default="{ row }">
            {{ row.totalCount > 0 ? Math.round(row.successCount / row.totalCount * 100) : 0 }}%
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200">
          <template #default="{ row }">
            <el-button size="small" type="success" v-if="row.status === 'pending'" @click="startTask(row.id)">开始</el-button>
            <el-button size="small" type="warning" v-if="row.status === 'running'" @click="pauseTask(row.id)">暂停</el-button>
            <el-button size="small" type="danger" v-if="row.status !== 'completed'" @click="cancelTask(row.id)">取消</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="showAddDialog" title="创建外呼任务" width="500px">
      <el-form :model="form" label-width="80px">
        <el-form-item label="任务名称">
          <el-input v-model="form.name" />
        </el-form-item>
        <el-form-item label="话术">
          <el-select v-model="form.scriptId" placeholder="选择话术">
            <el-option v-for="s in scripts" :key="s.id" :label="s.name" :value="s.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="客户">
          <el-select v-model="form.customerIds" multiple placeholder="选择客户">
            <el-option v-for="c in customers" :key="c.id" :label="c.name" :value="c.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="计划时间">
          <el-date-picker v-model="form.scheduleTime" type="datetime" placeholder="选择时间" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAddDialog = false">取消</el-button>
        <el-button type="primary" @click="createTask">创建</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import axios from 'axios'

const tasks = ref([])
const scripts = ref([])
const customers = ref([])
const showAddDialog = ref(false)
const form = ref({ name: '', scriptId: '', customerIds: [], scheduleTime: null })
const statusType = { pending: 'info', running: 'success', completed: 'success', paused: 'warning', cancelled: 'danger' }
const statusText = { pending: '待开始', running: '进行中', completed: '已完成', paused: '已暂停', cancelled: '已取消' }

const loadData = async () => {
  const token = localStorage.getItem('token')
  const headers = { Authorization: `Bearer ${token}` }
  
  const [tasksRes, scriptsRes, custRes] = await Promise.all([
    axios.get('/calls/tasks', { headers }),
    axios.get('/scripts', { headers }),
    axios.get('/customers', { headers })
  ])
  
  tasks.value = tasksRes.data || []
  scripts.value = scriptsRes.data || []
  customers.value = custRes.data || []
}

const createTask = async () => {
  try {
    const token = localStorage.getItem('token')
    await axios.post('/calls/tasks', form.value, { 
      headers: { Authorization: `Bearer ${token}` } 
    })
    ElMessage.success('创建成功')
    showAddDialog.value = false
    loadData()
  } catch (e) {
    ElMessage.error('创建失败')
  }
}

const startTask = async (id) => {
  try {
    const token = localStorage.getItem('token')
    await axios.post(`/calls/tasks/${id}/start`, {}, { 
      headers: { Authorization: `Bearer ${token}` } 
    })
    ElMessage.success('任务已开始')
    loadData()
  } catch (e) {
    ElMessage.error('启动失败')
  }
}

const pauseTask = async (id) => {
  try {
    const token = localStorage.getItem('token')
    await axios.post(`/calls/tasks/${id}/pause`, {}, { 
      headers: { Authorization: `Bearer ${token}` } 
    })
    ElMessage.success('任务已暂停')
    loadData()
  } catch (e) {
    ElMessage.error('暂停失败')
  }
}

const cancelTask = async (id) => {
  try {
    const token = localStorage.getItem('token')
    await axios.post(`/calls/tasks/${id}/cancel`, {}, { 
      headers: { Authorization: `Bearer ${token}` } 
    })
    ElMessage.success('任务已取消')
    loadData()
  } catch (e) {
    ElMessage.error('取消失败')
  }
}

onMounted(loadData)
</script>

<style scoped>
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}
</style>