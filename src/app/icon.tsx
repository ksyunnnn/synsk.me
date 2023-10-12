import { ImageResponse } from 'next/server';

// Route segment config
export const runtime = 'edge';

// Image metadata
export const size = {
  width: 32,
  height: 32,
};
export const contentType = 'image/png';

const url =
  'https://api.open-meteo.com/v1/forecast?latitude=35.6895&longitude=139.6917&current=weathercode&timezone=Asia%2FTokyo&forecast_days=1';

/**
 * @see https://open-meteo.com/en/docs Weather variable documentation
 */
const getWeatherIcon = (weathercode: string) => {
  switch (true) {
    case Number(weathercode) === 0:
      return '☀';
    case Number(weathercode) >= 1 && Number(weathercode) <= 3:
      return '⛅';
    case Number(weathercode) >= 40 && Number(weathercode) <= 49:
      return '🌫';
    case Number(weathercode) >= 50 && Number(weathercode) <= 59:
      return '🌧';
    case Number(weathercode) >= 60 && Number(weathercode) <= 69:
      return '☔';
    case Number(weathercode) >= 70 && Number(weathercode) <= 79:
      return '☃';
    case Number(weathercode) >= 80 && Number(weathercode) <= 84:
      return '🌦';
    case Number(weathercode) >= 85 && Number(weathercode) <= 89:
      return '🌨';
    case Number(weathercode) >= 90 && Number(weathercode) <= 99:
      return '⚡';

    default:
      return '👻';
  }
};

// Image generation
export default async function Icon() {
  const json = await fetch(url).then((res) => res.json());

  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 24,
          borderRadius: '50%',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#333',
        }}
      >
        <span>{getWeatherIcon(json.current.weathercode)}</span>
      </div>
    ),
    {
      ...size,
    }
  );
}
