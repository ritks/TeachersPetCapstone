import { describe, expect, it } from 'vitest'
import { buildStudentClassCards } from './studentDashboardAccess'

describe('buildStudentClassCards', () => {
  it('unlocks modules assigned through one of the student groups', () => {
    const cards = buildStudentClassCards({
      studentEmail: 'student@example.com',
      classDocs: [{ id: 'class-1', name: 'Algebra Lab', teacherName: 'Ms. Frizzle' }],
      enrollments: [{ classId: 'class-1', className: 'Algebra Lab', studentEmail: 'student@example.com' }],
      moduleMapByClass: {
        'class-1': [{ moduleId: 'module-1', moduleName: 'Linear Equations', moduleStatus: 'active' }],
      },
      groupRows: [{ id: 'group-1', classId: 'class-1', members: ['student@example.com'] }],
      moduleGroupAccessRows: [{ classId: 'class-1', moduleId: 'module-1', groupIds: ['group-1'] }],
    })

    expect(cards[0].modules[0]).toMatchObject({
      moduleId: 'module-1',
      moduleName: 'Linear Equations',
      unlocked: true,
    })
  })

  it('keeps group-assigned modules locked for students outside the assigned groups', () => {
    const cards = buildStudentClassCards({
      studentEmail: 'other@example.com',
      classDocs: [{ id: 'class-1', name: 'Algebra Lab' }],
      enrollments: [{ classId: 'class-1', studentEmail: 'other@example.com' }],
      moduleMapByClass: {
        'class-1': [{ moduleId: 'module-1', moduleName: 'Linear Equations' }],
      },
      groupRows: [{ id: 'group-1', classId: 'class-1', members: ['student@example.com'] }],
      moduleGroupAccessRows: [{ classId: 'class-1', moduleId: 'module-1', groupIds: ['group-1'] }],
    })

    expect(cards[0].modules[0].unlocked).toBe(false)
  })
})
