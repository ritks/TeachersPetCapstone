function keyFor(classId, moduleId) {
  return `${classId}::${moduleId}`
}

export function normalizeEmail(value) {
  return (value || '').trim().toLowerCase()
}

export function buildStudentClassCards({
  accessRows = [],
  classDocs = [],
  classNameByClassId = {},
  codeRows = [],
  enrollments = [],
  groupRows = [],
  moduleGroupAccessRows = [],
  moduleMapByClass = {},
  moduleMetaById = {},
  studentEmail = '',
}) {
  const normalizedStudentEmail = normalizeEmail(studentEmail)
  const accessMap = {}
  const courseCodeByModuleKey = {}
  const groupIdsForStudentByClass = {}
  const groupAccessMap = {}

  accessRows.forEach((row) => {
    if (!row.classId || !row.moduleId) return
    accessMap[keyFor(row.classId, row.moduleId)] = Boolean(row.isUnlocked)
    if (row.className && !classNameByClassId[row.classId]) classNameByClassId[row.classId] = row.className
  })

  codeRows.forEach((row) => {
    if (!row.classId || !row.moduleId) return
    if (row.className && !classNameByClassId[row.classId]) classNameByClassId[row.classId] = row.className
    courseCodeByModuleKey[keyFor(row.classId, row.moduleId)] = row.code
  })

  enrollments.forEach((row) => {
    if (row.classId && row.className && !classNameByClassId[row.classId]) {
      classNameByClassId[row.classId] = row.className
    }
  })

  groupRows.forEach((group) => {
    if (!group.classId || !group.id || !Array.isArray(group.members)) return
    const containsStudent = group.members.some((memberEmail) => normalizeEmail(memberEmail) === normalizedStudentEmail)
    if (!containsStudent) return
    if (!groupIdsForStudentByClass[group.classId]) groupIdsForStudentByClass[group.classId] = new Set()
    groupIdsForStudentByClass[group.classId].add(group.id)
  })

  moduleGroupAccessRows.forEach((row) => {
    if (!row.classId || !row.moduleId || !Array.isArray(row.groupIds)) return
    groupAccessMap[keyFor(row.classId, row.moduleId)] = new Set(row.groupIds.filter(Boolean))
    if (row.className && !classNameByClassId[row.classId]) classNameByClassId[row.classId] = row.className
  })

  return classDocs.map((classDoc) => {
    const fromClassModules = (moduleMapByClass[classDoc.id] || []).map((m) => ({
      moduleId: m.moduleId,
      moduleName: m.moduleName || 'Module',
      moduleStatus: m.moduleStatus || 'active',
    }))
    const fromAccess = accessRows
      .filter((a) => a.classId === classDoc.id)
      .map((a) => ({
        moduleId: a.moduleId,
        moduleName: a.moduleName || 'Module',
        moduleStatus: 'active',
      }))
    const fromCodes = codeRows
      .filter((c) => c.classId === classDoc.id)
      .map((c) => ({
        moduleId: c.moduleId,
        moduleName: c.moduleName || 'Module',
        moduleStatus: 'active',
      }))

    const seen = new Set()
    const classModules = [...fromClassModules, ...fromAccess, ...fromCodes].filter((m) => {
      if (!m.moduleId || seen.has(m.moduleId)) return false
      seen.add(m.moduleId)
      return true
    })

    const studentGroupIds = groupIdsForStudentByClass[classDoc.id] || new Set()
    const modules = classModules.map((m) => {
      const moduleKey = keyFor(classDoc.id, m.moduleId)
      const assignedGroupIds = groupAccessMap[moduleKey] || new Set()
      const groupUnlocked = [...studentGroupIds].some((groupId) => assignedGroupIds.has(groupId))
      const unlocked = accessMap[moduleKey] === true || groupUnlocked
      const moduleMeta = moduleMetaById[m.moduleId]
      return {
        moduleId: m.moduleId,
        moduleName: moduleMeta?.name || m.moduleName || 'Module',
        moduleDescription: moduleMeta?.description || null,
        moduleStatus: m.moduleStatus || 'active',
        unlocked,
        courseCode: courseCodeByModuleKey[moduleKey] || null,
      }
    })

    const enrollmentRow = enrollments.find((e) => e.classId === classDoc.id)
    const inferredName = (classDoc.name && classDoc.name !== 'Class')
      ? classDoc.name
      : enrollmentRow?.className || classNameByClassId[classDoc.id] || 'Class'

    return {
      id: classDoc.id,
      name: inferredName,
      teacherName: classDoc.teacherName || classDoc.teacherUid || enrollmentRow?.teacherName || null,
      modules,
    }
  })
}
