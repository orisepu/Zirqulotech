'use client'

import { Box, Typography, Button, Alert, Card, CardContent } from '@mui/material'
import { useState } from 'react'
import { useLearningMetrics, useKnowledgeBaseStats, useLaunchV3UpdateTask } from '@/hooks/useLearningV3'

export default function TestV3Page() {
  const [testResults, setTestResults] = useState<Record<string, any>>({})

  const { data: metrics, error: metricsError, refetch: refetchMetrics } = useLearningMetrics()
  const { data: kbStats, error: kbError, refetch: refetchKbStats } = useKnowledgeBaseStats()
  const { mutate: launchV3, isPending: isLaunching } = useLaunchV3UpdateTask()

  const testEndpoint = async (name: string, testFn: () => Promise<any>) => {
    try {
      const result = await testFn()
      setTestResults(prev => ({
        ...prev,
        [name]: { success: true, data: result }
      }))
    } catch (error: any) {
      setTestResults(prev => ({
        ...prev,
        [name]: { success: false, error: error.message || error.toString() }
      }))
    }
  }

  const runAllTests = () => {
    testEndpoint('metrics', () => refetchMetrics())
    testEndpoint('kbStats', () => refetchKbStats())
  }

  const testLaunchV3 = () => {
    console.log('Testing V3 launch...')
    launchV3({
      enable_learning: true,
      confidence_threshold: 0.7,
      parallel_requests: 2
    }, {
      onSuccess: (result) => {
        console.log('V3 Launch success:', result)
        setTestResults(prev => ({
          ...prev,
          launch: { success: true, data: result }
        }))
      },
      onError: (error: any) => {
        console.error('V3 Launch error:', error)
        setTestResults(prev => ({
          ...prev,
          launch: { success: false, error: error?.response?.data?.message || error?.message || error?.toString() || 'Error desconocido' }
        }))
      }
    })
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Test V3 API Endpoints
      </Typography>

      <Box sx={{ mb: 3 }}>
        <Button
          variant="contained"
          onClick={runAllTests}
          sx={{ mr: 2 }}
        >
          Test Read Endpoints
        </Button>
        <Button
          variant="contained"
          color="secondary"
          onClick={testLaunchV3}
          disabled={isLaunching}
        >
          Test Launch V3 Update
        </Button>
      </Box>

      {/* Results */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {/* Metrics Test */}
        <Card>
          <CardContent>
            <Typography variant="h6">Metrics Endpoint</Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              GET /api/likewize/v3/metrics/
            </Typography>
            {metricsError && (
              <Alert severity="error" sx={{ mt: 1 }}>
                Error: {metricsError.message}
              </Alert>
            )}
            {metrics && (
              <Alert severity="success" sx={{ mt: 1 }}>
                Success: {JSON.stringify(metrics).substring(0, 100)}...
              </Alert>
            )}
            {testResults.metrics && (
              <Alert
                severity={testResults.metrics.success ? 'success' : 'error'}
                sx={{ mt: 1 }}
              >
                {testResults.metrics.success
                  ? `Success: ${JSON.stringify(testResults.metrics.data).substring(0, 100)}...`
                  : `Error: ${testResults.metrics.error}`
                }
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* KB Stats Test */}
        <Card>
          <CardContent>
            <Typography variant="h6">Knowledge Base Stats</Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              GET /api/likewize/v3/knowledge-base/stats/
            </Typography>
            {kbError && (
              <Alert severity="error" sx={{ mt: 1 }}>
                Error: {kbError.message}
              </Alert>
            )}
            {kbStats && (
              <Alert severity="success" sx={{ mt: 1 }}>
                Success: {JSON.stringify(kbStats).substring(0, 100)}...
              </Alert>
            )}
            {testResults.kbStats && (
              <Alert
                severity={testResults.kbStats.success ? 'success' : 'error'}
                sx={{ mt: 1 }}
              >
                {testResults.kbStats.success
                  ? `Success: ${JSON.stringify(testResults.kbStats.data).substring(0, 100)}...`
                  : `Error: ${testResults.kbStats.error}`
                }
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Launch V3 Test */}
        <Card>
          <CardContent>
            <Typography variant="h6">Launch V3 Update</Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              POST /api/likewize/v3/actualizar/
            </Typography>
            {testResults.launch && (
              <Alert
                severity={testResults.launch.success ? 'success' : 'error'}
                sx={{ mt: 1 }}
              >
                {testResults.launch.success
                  ? `Success: ${JSON.stringify(testResults.launch.data).substring(0, 100)}...`
                  : `Error: ${testResults.launch.error}`
                }
              </Alert>
            )}
          </CardContent>
        </Card>
      </Box>
    </Box>
  )
}