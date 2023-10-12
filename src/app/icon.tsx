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
          background: '#F9F8F4',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#333',
          paddingTop: 4,
          paddingRight: 1,
        }}
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 161 160"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <g filter="url(#filter0_d_1085_61)">
            <path
              d="M158.745 75.1472C159.013 76.4901 159.282 77.833 159.282 79.1759V98.2451C159.282 115.166 145.316 128.595 128.127 128.595H118.189C102.074 128.595 88.6454 116.508 87.3025 100.394L86.4968 89.9191H77.0965L76.2908 100.394C74.9479 116.508 61.5189 128.595 45.4041 128.595H35.4667C18.2776 128.595 4.58008 115.166 4.58008 98.2451V79.1759C4.58008 77.833 4.58008 76.4901 4.84866 75.1472L17.2033 26.2658C18.8148 19.8199 22.8435 14.4483 28.7522 11.2254C34.3924 8.27098 41.3755 7.46525 47.5528 9.61388L51.5815 10.9568C53.9987 11.7625 55.073 14.1797 54.2673 16.3284L52.9244 20.6256C52.1186 22.7743 49.7014 23.8486 47.5528 23.3114L44.0612 21.9685C41.1069 21.1628 37.8839 21.1628 35.1981 22.5057C32.2438 23.8486 30.3637 26.5344 29.558 29.4888L19.3519 70.85C25.2607 68.9699 32.7809 67.3584 41.1069 67.3584C50.5071 67.3584 60.9817 69.2385 71.9935 74.6101H91.5998C102.612 69.2385 113.086 67.3584 122.486 67.3584C130.812 67.3584 138.333 68.9699 144.241 70.85L134.035 29.4888C133.23 26.5344 131.35 23.8486 128.395 22.5057C125.709 21.1628 122.486 21.1628 119.532 21.9685L116.041 23.3114C113.892 23.8486 111.475 22.7743 110.669 20.6256L109.326 16.3284C108.52 14.1797 109.595 11.7625 112.012 10.9568L116.041 9.61388C122.218 7.46525 129.201 8.27098 134.841 11.2254C140.75 14.4483 144.779 19.8199 146.39 26.2658L158.745 75.1472ZM59.1017 99.0508L59.9074 88.0391C53.7301 85.6218 47.5528 84.5475 41.1069 84.5475C33.3181 84.5475 26.6036 86.4276 21.7692 88.0391V98.2451C21.7692 105.497 27.6779 111.405 35.4667 111.405H45.4041C52.3872 111.405 58.5645 106.034 59.1017 99.0508ZM142.093 98.2451H141.824V88.0391C136.99 86.4276 130.275 84.5475 122.486 84.5475C116.041 84.5475 109.863 85.6218 103.686 88.0391L104.492 99.0508C105.029 106.034 111.206 111.405 118.189 111.405H128.127C135.915 111.405 142.093 105.497 142.093 98.2451Z"
              fill="#2C2F32"
            />
          </g>
          <defs>
            <filter
              id="filter0_d_1085_61"
              x="2.86117"
              y="0"
              width="159.859"
              height="161.577"
              filterUnits="userSpaceOnUse"
              color-interpolation-filters="sRGB"
            >
              <feFlood flood-opacity="0" result="BackgroundImageFix" />
              <feColorMatrix
                in="SourceAlpha"
                type="matrix"
                values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
                result="hardAlpha"
              />
              <feOffset dy="1.71891" />
              <feGaussianBlur stdDeviation="0.859454" />
              <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.08 0" />
              <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_1085_61" />
              <feBlend
                mode="normal"
                in="SourceGraphic"
                in2="effect1_dropShadow_1085_61"
                result="shape"
              />
            </filter>
          </defs>
        </svg>
      </div>
    ),
    {
      ...size,
    }
  );
}
