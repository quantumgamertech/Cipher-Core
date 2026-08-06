$ErrorActionPreference = 'SilentlyContinue'
$ProgressPreference = 'SilentlyContinue'

$nvidiaSmi = Get-Command 'nvidia-smi.exe' -ErrorAction SilentlyContinue
$lhmNamespace = $null

foreach ($candidate in @('root\LibreHardwareMonitor', 'root\OpenHardwareMonitor')) {
    try {
        if (Get-CimClass -Namespace $candidate -ClassName 'Sensor' -ErrorAction Stop) {
            $lhmNamespace = $candidate
            break
        }
    } catch {
        # Optional provider is unavailable.
    }
}

while ($true) {
    $sampleStarted = [DateTime]::UtcNow
    $cpuUsage = $null
    $gpuUsage = $null
    $cpuTemperature = $null
    $gpuTemperature = $null
    $networkBytesPerSecond = 0.0
    $networkCapacityBitsPerSecond = 0.0
    $gpuUsageSource = 'windows-performance-counters'
    $cpuTemperatureSource = 'unavailable'
    $gpuTemperatureSource = 'unavailable'

    try {
        $cpu = Get-CimInstance Win32_PerfFormattedData_Counters_ProcessorInformation `
            -Filter "Name='_Total'" |
            Select-Object -First 1
        if ($null -ne $cpu.PercentProcessorUtility) {
            $cpuUsage = [double]$cpu.PercentProcessorUtility
        } elseif ($null -ne $cpu.PercentProcessorTime) {
            $cpuUsage = [double]$cpu.PercentProcessorTime
        }
    } catch {
        $cpuUsage = $null
    }

    try {
        $gpuEngines = Get-CimInstance Win32_PerfFormattedData_GPUPerformanceCounters_GPUEngine |
            Where-Object { $_.Name -match 'engtype_(3D|Compute)' }
        if ($gpuEngines) {
            $gpuUsage = [double](($gpuEngines |
                Measure-Object -Property UtilizationPercentage -Maximum).Maximum)
        }
    } catch {
        $gpuUsage = $null
    }

    try {
        $interfaces = Get-CimInstance Win32_PerfFormattedData_Tcpip_NetworkInterface |
            Where-Object { [double]$_.CurrentBandwidth -gt 0 }
        if ($interfaces) {
            $networkBytesPerSecond = [double](($interfaces |
                Measure-Object -Property BytesTotalPersec -Sum).Sum)
            $networkCapacityBitsPerSecond = [double](($interfaces |
                Measure-Object -Property CurrentBandwidth -Sum).Sum)
        }
    } catch {
        $networkBytesPerSecond = 0.0
        $networkCapacityBitsPerSecond = 0.0
    }

    if ($nvidiaSmi) {
        try {
            $gpuLine = (& $nvidiaSmi.Source `
                '--query-gpu=utilization.gpu,temperature.gpu' `
                '--format=csv,noheader,nounits' |
                Select-Object -First 1)
            if ($gpuLine) {
                $gpuParts = $gpuLine -split ','
                $nvidiaUsage = 0.0
                $nvidiaTemperature = 0.0
                if ([double]::TryParse($gpuParts[0].Trim(), [ref]$nvidiaUsage)) {
                    if ($null -eq $gpuUsage) {
                        $gpuUsage = $nvidiaUsage
                        $gpuUsageSource = 'nvidia-smi'
                    }
                }
                if ($gpuParts.Count -gt 1 -and
                    [double]::TryParse($gpuParts[1].Trim(), [ref]$nvidiaTemperature)) {
                    $gpuTemperature = $nvidiaTemperature
                    $gpuTemperatureSource = 'nvidia-smi'
                }
            }
        } catch {
            $gpuTemperature = $null
        }
    }

    if ($lhmNamespace) {
        try {
            $temperatureSensors = Get-CimInstance -Namespace $lhmNamespace -ClassName 'Sensor' |
                Where-Object { $_.SensorType -eq 'Temperature' }

            $cpuSensor = $temperatureSensors |
                Where-Object { $_.Name -match 'CPU Package|CPU \(Tctl/Tdie\)|Core Average' } |
                Select-Object -First 1
            $gpuSensor = $temperatureSensors |
                Where-Object { $_.Name -match 'GPU Core|GPU Temperature' } |
                Select-Object -First 1

            if ($cpuSensor) {
                $cpuTemperature = [double]$cpuSensor.Value
                $cpuTemperatureSource = 'libre-hardware-monitor'
            }
            if ($gpuSensor) {
                $gpuTemperature = [double]$gpuSensor.Value
                $gpuTemperatureSource = 'libre-hardware-monitor'
            }
        } catch {
            $cpuTemperature = $null
        }
    }

    $networkUtilization = 0.0
    if ($networkCapacityBitsPerSecond -gt 0) {
        $networkUtilization =
            (($networkBytesPerSecond * 8.0) / $networkCapacityBitsPerSecond) * 100.0
    }

    [ordered]@{
        cpuUsage                  = $cpuUsage
        cpuTemperature            = $cpuTemperature
        gpuUsage                  = $gpuUsage
        gpuTemperature            = $gpuTemperature
        networkBytesPerSecond     = $networkBytesPerSecond
        networkUtilization        = $networkUtilization
        gpuUsageSource             = $gpuUsageSource
        cpuTemperatureSource       = $cpuTemperatureSource
        gpuTemperatureSource       = $gpuTemperatureSource
        sampledAt                  = [DateTime]::UtcNow.ToString('o')
    } | ConvertTo-Json -Compress | Write-Output

    [Console]::Out.Flush()
    $elapsed = ([DateTime]::UtcNow - $sampleStarted).TotalMilliseconds
    $delay = [Math]::Max(100, 1000 - [int]$elapsed)
    Start-Sleep -Milliseconds $delay
}
