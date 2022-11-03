# i18next google sheet action

i18next 다국어 싱크 작업 자동화 action입니다.
다국어가 적용될 레포 내의 locales/ 하위 json 파일과 구글 스프레드 시트를 동기화 하여, 변동사항이 생기는 경우 싱크 PR을 생성합니다.

## Inputs

### `path`

**Required** JSON 파일이 들어있는 locales 디렉토리. Default 'locales/'.

### `range`

**Required** 스프레드시트에서 데이터를 읽고 쓸 범위. Default '시트1'.

### `spreadsheet-id`

**Required** 스프레드시트 고유 ID

## Outputs

### `stats`

다국어 싱크 동기화 작업 결과

## Example usage

```yaml
- name: Sync locale with google sheet
  uses: croquiscom/i18next-google-sheet-action@v1
  env:
  GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  GOOGLE_SHEET_CREDENTIALS: ${{ secrets.GOOGLE_SHEET_CREDENTIALS }}
```

## 로컬에서 테스트하는 방법
