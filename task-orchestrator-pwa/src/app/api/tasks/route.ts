import { NextRequest, NextResponse } from 'next/server'

interface Task {
  id: string
  text: string
  completed: boolean
  createdAt: string
}

// In-memory store for demo purposes
const tasks: Task[] = []

export async function GET() {
  return NextResponse.json(tasks)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, task } = body

    switch (action) {
      case 'create':
        const newTask = { ...task, id: Date.now().toString() }
        tasks.push(newTask)
        return NextResponse.json(newTask)
      
      case 'toggle':
        const taskToToggle = tasks.find(t => t.id === task.id)
        if (taskToToggle) {
          taskToToggle.completed = !taskToToggle.completed
        }
        return NextResponse.json(taskToToggle)
      
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (!id) {
      return NextResponse.json({ error: 'Task ID required' }, { status: 400 })
    }
    
    const index = tasks.findIndex(t => t.id === id)
    if (index > -1) {
      tasks.splice(index, 1)
      return NextResponse.json({ success: true })
    }
    
    return NextResponse.json({ error: 'Task not found' }, { status: 404 })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
