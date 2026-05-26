<template>
  <div class="scripts">
    <div class="header">
      <h2>话术管理</h2>
      <div class="header-actions">
        <el-input 
          v-model="searchKeyword" 
          placeholder="搜索话术..." 
          style="width: 200px; margin-right: 10px;"
          clearable
          @input="loadScripts"
        >
          <template #prefix>🔍</template>
        </el-input>
        <el-button @click="showImportDialog = true">📥 批量导入</el-button>
        <el-button type="primary" @click="openAddDialog">+ 添加话术</el-button>
      </div>
    </div>

    <el-card>
      <el-table :data="filteredScripts" style="width: 100%" v-loading="loading">
        <el-table-column prop="name" label="话术名称" width="150" />
        <el-table-column label="类型" width="120">
          <template #default="{ row }">
            <el-tag>{{ typeMap[row.type] }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="textContent" label="内容" show-overflow-tooltip />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-switch
              v-model="row.isActive"
              :loading="row.switching"
              @change="toggleStatus(row)"
            />
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="160">
          <template #default="{ row }">
            {{ formatDate(row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="openEditDialog(row)">编辑</el-button>
            <el-button size="small" type="danger" @click="deleteScript(row.id)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 添加/编辑弹窗 -->
    <el-dialog v-model="showDialog" :title="isEdit ? '编辑话术' : '添加话术'" width="700px" @close="resetForm">
      <el-form :model="form" label-width="80px" :rules="rules" ref="formRef">
        <el-form-item label="名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入话术名称" />
        </el-form-item>
        <el-form-item label="类型" prop="type">
          <el-select v-model="form.type" style="width: 100%">
            <el-option label="开场白" value="opening" />
            <el-option label="产品介绍" value="general" />
            <el-option label="处理异议" value="objection" />
            <el-option label="结束语" value="closing" />
          </el-select>
        </el-form-item>
        <el-form-item label="内容" prop="textContent">
          <el-input 
            v-model="form.textContent" 
            type="textarea" 
            :rows="8" 
            placeholder="请输入话术内容..."
            show-word-limit
            :maxlength="2000"
          />
        </el-form-item>
        <el-form-item label="启用">
          <el-switch v-model="form.isActive" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showDialog = false">取消</el-button>
        <el-button type="primary" @click="saveScript" :loading="saving">保存</el-button>
      </template>
    </el-dialog>

    <!-- 批量导入弹窗 -->
    <el-dialog v-model="showImportDialog" title="批量导入话术" width="700px">
      <el-alert
        title="导入格式说明"
        type="info"
        :closable="false"
        style="margin-bottom: 15px;"
      >
        每行一个话术，格式：名称|类型|内容<br>
        类型可选：opening(开场白) | general(产品介绍) | objection(处理异议) | closing(结束语)
      </el-alert>
      <el-input
        v-model="importText"
        type="textarea"
        :rows="15"
        placeholder="示例：
邀约开场|opening|您好，我是XX律师事务所的...
案件咨询|general|请问您有什么法律需求？
价格异议|objection|我们的服务是明码标价的...
预约面谈|closing|那我们约个时间面谈吧？"
      />
      <template #footer>
        <el-button @click="showImportDialog = false">取消</el-button>
        <el-button type="primary" @click="importScripts" :loading="importing">导入</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import axios from 'axios'

const scripts = ref([])
const loading = ref(false)
const saving = ref(false)
const importing = ref(false)
const showDialog = ref(false)
const showImportDialog = ref(false)
const isEdit = ref(false)
const searchKeyword = ref('')
const importText = ref('')
const formRef = ref(null)

const form = ref({
  id: '',
  name: '',
  type: 'general',
  textContent: '',
  isActive: true
})

const rules = {
  name: [{ required: true, message: '请输入话术名称', trigger: 'blur' }],
  type: [{ required: true, message: '请选择类型', trigger: 'change' }],
  textContent: [{ required: true, message: '请输入话术内容', trigger: 'blur' }]
}

const typeMap = { opening: '开场白', general: '产品介绍', objection: '处理异议', closing: '结束语' }

const filteredScripts = computed(() => {
  if (!searchKeyword.value) return scripts.value
  const kw = searchKeyword.value.toLowerCase()
  return scripts.value.filter(s => 
    s.name?.toLowerCase().includes(kw) || 
    s.textContent?.toLowerCase().includes(kw)
  )
})

const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleString('zh-CN', { 
    year: 'numeric', 
    month: '2-digit', 
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const loadScripts = async () => {
  loading.value = true
  try {
    const token = localStorage.getItem('token')
    if (!token) {
      ElMessage.warning('请先登录')
      return
    }
    const { data } = await axios.get('/scripts', { 
      headers: { Authorization: `Bearer ${token}` }
    })
    scripts.value = (data || []).map(s => ({ ...s, switching: false }))
  } catch (e) {
    console.error('加载话术失败:', e)
    ElMessage.error('加载失败')
  } finally {
    loading.value = false
  }
}

const openAddDialog = () => {
  isEdit.value = false
  resetForm()
  showDialog.value = true
}

const openEditDialog = (row) => {
  isEdit.value = true
  form.value = { 
    id: row.id,
    name: row.name,
    type: row.type,
    textContent: row.textContent,
    isActive: row.isActive
  }
  showDialog.value = true
}

const resetForm = () => {
  form.value = {
    id: '',
    name: '',
    type: 'general',
    textContent: '',
    isActive: true
  }
}

const saveScript = async () => {
  if (!formRef.value) return
  
  await formRef.value.validate(async (valid) => {
    if (!valid) return
    
    saving.value = true
    try {
      const token = localStorage.getItem('token')
      const headers = { Authorization: `Bearer ${token}` }
      
      if (isEdit.value) {
        // 编辑
        const updateData = { ...form.value }
        delete updateData.id
        await axios.patch(`/scripts/${form.value.id}`, updateData, { headers })
        ElMessage.success('修改成功')
      } else {
        // 新增
        await axios.post('/scripts', form.value, { headers })
        ElMessage.success('添加成功')
      }
      
      showDialog.value = false
      resetForm()
      loadScripts()
    } catch (e) {
      console.error('保存话术失败:', e)
      const errMsg = e.response?.data?.message || e.message || '未知错误'
      ElMessage.error('保存失败: ' + errMsg)
    } finally {
      saving.value = false
    }
  })
}

const toggleStatus = async (row) => {
  row.switching = true
  try {
    const token = localStorage.getItem('token')
    await axios.patch(`/scripts/${row.id}`, 
      { isActive: row.isActive },
      { headers: { Authorization: `Bearer ${token}` } }
    )
    ElMessage.success(row.isActive ? '已启用' : '已禁用')
  } catch (e) {
    ElMessage.error('操作失败')
    row.isActive = !row.isActive // 恢复原状态
  } finally {
    row.switching = false
  }
}

const importScripts = async () => {
  if (!importText.value.trim()) {
    ElMessage.warning('请输入话术内容')
    return
  }
  
  importing.value = true
  try {
    const token = localStorage.getItem('token')
    const headers = { Authorization: `Bearer ${token}` }
    const lines = importText.value.trim().split('\n')
    let successCount = 0
    
    for (const line of lines) {
      if (!line.trim()) continue
      
      // 解析格式：名称|类型|内容
      const parts = line.split('|')
      if (parts.length < 3) continue
      
      const [name, type, textContent] = parts
      await axios.post('/scripts', {
        name: name.trim(),
        type: ['opening', 'general', 'objection', 'closing'].includes(type.trim()) ? type.trim() : 'general',
        textContent: textContent.trim(),
        isActive: true
      }, { headers })
      successCount++
    }
    
    ElMessage.success(`成功导入 ${successCount} 条话术`)
    showImportDialog.value = false
    importText.value = ''
    loadScripts()
  } catch (e) {
    console.error('导入失败:', e)
    ElMessage.error('导入失败')
  } finally {
    importing.value = false
  }
}

const deleteScript = async (id) => {
  try {
    await ElMessageBox.confirm('确定删除该话术?', '警告', { type: 'warning' })
    const token = localStorage.getItem('token')
    await axios.delete(`/scripts/${id}`, { 
      headers: { Authorization: `Bearer ${token}` } 
    })
    ElMessage.success('删除成功')
    loadScripts()
  } catch (e) {
    if (e !== 'cancel') {
      ElMessage.error('删除失败')
    }
  }
}

onMounted(loadScripts)
</script>

<style scoped>
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.header-actions {
  display: flex;
  align-items: center;
}
</style>