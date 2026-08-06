using System.Text.Json;
using LibreHardwareMonitor.Hardware;

string[] preferredSensors =
[
    "CPU Package",
    "CPU (Tctl/Tdie)",
    "Core (Tctl/Tdie)",
    "Core Average",
];

string? outputFile = ReadArgument(args, "--output-file");
bool watch = args.Contains("--watch", StringComparer.OrdinalIgnoreCase);
int? parentPid = int.TryParse(ReadArgument(args, "--parent-pid"), out int parsedParentPid)
    ? parsedParentPid
    : null;

do
{
    string json = ReadSample(preferredSensors);
    Console.WriteLine(json);

    if (outputFile is not null)
    {
        try
        {
            string? directory = Path.GetDirectoryName(outputFile);
            if (!string.IsNullOrEmpty(directory))
            {
                Directory.CreateDirectory(directory);
            }
            File.WriteAllText(outputFile, json);
        }
        catch
        {
            // Stdout remains the canonical output if the optional cache is unavailable.
        }
    }

    if (!watch)
    {
        break;
    }

    Thread.Sleep(1000);
}
while (parentPid is null || IsProcessRunning(parentPid.Value));

static string ReadSample(IReadOnlyCollection<string> preferredSensors)
{
    Computer? computer = null;

    try
    {
        computer = new Computer
        {
            IsCpuEnabled = true,
        };
        computer.Open();

        List<ISensor> temperatureSensors = [];
        foreach (IHardware hardware in computer.Hardware.Where(
                     item => item.HardwareType == HardwareType.Cpu))
        {
            CollectTemperatureSensors(hardware, temperatureSensors);
        }

        ISensor? selected = preferredSensors
            .Select(name => temperatureSensors.FirstOrDefault(sensor =>
                string.Equals(sensor.Name, name, StringComparison.OrdinalIgnoreCase)
                && IsValidCpuTemperature(sensor.Value)))
            .FirstOrDefault(sensor => sensor is not null);

        return SerializeSample(
            selected is null ? "unavailable" : "live",
            selected?.Value,
            selected?.Name);
    }
    catch
    {
        return SerializeSample("unavailable", null, null);
    }
    finally
    {
        computer?.Close();
    }
}

static string? ReadArgument(IReadOnlyList<string> arguments, string name)
{
    for (int index = 0; index < arguments.Count - 1; index++)
    {
        if (string.Equals(arguments[index], name, StringComparison.OrdinalIgnoreCase))
        {
            return arguments[index + 1];
        }
    }
    return null;
}

static bool IsProcessRunning(int processId)
{
    try
    {
        using System.Diagnostics.Process process =
            System.Diagnostics.Process.GetProcessById(processId);
        return !process.HasExited;
    }
    catch
    {
        return false;
    }
}

static bool IsValidCpuTemperature(float? temperature)
{
    return temperature is > 0 and <= 125
        && float.IsFinite(temperature.Value);
}

static void CollectTemperatureSensors(
    IHardware hardware,
    ICollection<ISensor> destination)
{
    hardware.Update();

    foreach (ISensor sensor in hardware.Sensors)
    {
        if (sensor.SensorType == SensorType.Temperature)
        {
            destination.Add(sensor);
        }
    }

    foreach (IHardware child in hardware.SubHardware)
    {
        CollectTemperatureSensors(child, destination);
    }
}

static string SerializeSample(string status, float? temperature, string? sensor)
{
    return JsonSerializer.Serialize(new
    {
        schemaVersion = 1,
        sampledAt = DateTimeOffset.UtcNow,
        status,
        cpuTemperature = temperature is null
            ? (double?)null
            : Math.Round(temperature.Value, 1),
        unit = "celsius",
        source = "librehardwaremonitor",
        sensor,
    });
}
